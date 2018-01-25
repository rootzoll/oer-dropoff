import { Component } from '@angular/core';
import { Ng2FileDropAcceptedFile, Ng2FileDropRejectedFile } from 'ng2-file-drop';
import { HttpModule, Http, Response, Headers, RequestOptions } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { MatDrawerToggleResult } from '@angular/material';
import { prepareProfile } from 'selenium-webdriver/firefox';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  step:number = 1;

  legalCheckboxOne:boolean;
  legalCheckboxTwo:boolean;

  opacityCheck1:number;
  opacityCheck2:number;

  uploadFileName:string;
  uploadProgress:number;
  uploadMode:string;
  uploadFile:File;

  // edu-sharing API config
  eduApiUrl:string = 'http://edu41.edu-sharing.de/edu-sharing/rest/';
  eduApiUser:string = 'oer-dropoff';
  eduApiPass:string = 'oer-dropoff';

  constructor(public http: Http) {
    this.buttonReset();
  }

  buttonDropIt() {

    if (!this.legalCheckboxOne) {
      this.blinkCheck1();
      return;
    }
    if (!this.legalCheckboxTwo) {
      this.blinkCheck2();
      return;
    }

    this.uploadFileProcess(this.uploadFile);
  }

  buttonReset() {

    this.uploadFile = null;
    this.uploadFileName = "";
    this.uploadProgress = -1;
    this.uploadMode = "determinate";
    this.step = 1;

    this.legalCheckboxOne = false;
    this.legalCheckboxTwo = false;
  
    this.opacityCheck1 = 0;
    this.opacityCheck2 = 0;
  }

  // File being dragged has been dropped and is valid
  private dragFileAccepted(acceptedFile: Ng2FileDropAcceptedFile):void {

    // block file drops during upload or on multiple files
    if (this.step > 1) { return; }

    // set file data
    this.uploadFile = acceptedFile.file;
    this.getReadyStep2();
  
  }

  manualChooseFile($event):void {
    if (this.step > 1) { return; }
    this.uploadFile = $event.srcElement.files[0];
    this.getReadyStep2();
  }

  getReadyStep2():void {
    this.uploadFileName = this.uploadFile.name;
    this.opacityCheck1 = 1;
    this.opacityCheck2 = 1;
    this.step = 2;

  } 

  blinkCheck1():void {
      this.opacityCheck1 = 0;
      setTimeout(()=>{
        this.opacityCheck1 = 1;
      },500);
  };

  blinkCheck2():void {
      this.opacityCheck2 = 0;
      setTimeout(()=>{
        this.opacityCheck2 = 1;
      },500);
  };


  // File being dragged has been dropped and has been rejected
  private dragFileRejected(rejectedFile: Ng2FileDropRejectedFile) {
    console.log('TODO: dragFileRejected', rejectedFile);
  }

  private uploadFileProcess(file:File) : void {

    // let progressbar show movement
    this.uploadProgress = 0;
    this.uploadMode = "indeterminate";

    this.httpAuthorize((oAuthToken)=>{
      
      // WIN
      console.log("OK Auth - Got Token:"+oAuthToken);
      this.httpCreateInboxNode(oAuthToken, file.name, (nodeId) => {

        // WIN
        console.log("OK Create Inbox node with id:"+nodeId);
        this.sendDataViaXHR(file, oAuthToken, nodeId).subscribe(()=>{

          // WIN
          console.log("OK File was uploaded");
          this.step = 3;
     
        }, (error) => {
          alert("FAIL Content Upload");
        });

      }, (error) =>{

        // FAIL
        alert("FAIL create inbox node");

      });

    }, (error) => {
      // FAIL
      alert("FAIL oAuth on Repo");
    }); 

  }

  // gets a oAuth token from server --> callback(token:string)
  private httpAuthorize(callbackWin:Function, callbackFail:Function) {  
    const headers: Headers = new Headers();
    headers.append('Content-Type', 'application/x-www-form-urlencoded');
    headers.append('Accept', '*/*');
    const opts: RequestOptions = new RequestOptions();
    opts.headers = headers;
    this.http.post(
      this.eduApiUrl.substr(0, this.eduApiUrl.length - 5) + 'oauth2/token',
      'grant_type=password&client_id=eduApp&client_secret=secret'
       + '&username='
       + encodeURIComponent(this.eduApiUser)
       + '&password='
       + encodeURIComponent(this.eduApiPass), opts)
      .subscribe( (result: Response) => {
        callbackWin(result.json().access_token);
    } );
  }


  private httpCreateInboxNode(token:string, name:string, callbackWin:Function, callbackError:Function) {
    const headers: Headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Authorization', 'Bearer' + token);
    const opts: RequestOptions = new RequestOptions();
    opts.headers = headers;

    const url = this.eduApiUrl
      + 'node/v1/nodes/-home-/-inbox-/children?renameIfExists=true&type=%7Bhttp%3A%2F%2Fwww.campuscontent.de%2Fmodel%2F1.0%7Dio';

    const body = `{
    "cm:name":[
      "` + name + `"
    ],
    "cclom:general_keyword":[ "dropoff" ]
    }`;

    this.http.post(
      url, body, opts)
      .subscribe( (result: Response) => {
        callbackWin(JSON.parse((result as any)._body).node.ref.id);
      }, (error) => {
        callbackError(error);
      });
  }

  public sendDataViaXHR(file: File, token:string, nodeId:string, method='POST', fieldName='file' ): Observable<XMLHttpRequest> {
    return Observable.create( (observer) => {
      
      let versionComment = {
        dropoff: true,
        claimCopyRightFree: true,
        commissionToPublish: true
      };

      const query = this.eduApiUrl
      + 'node/v1/nodes/-home-/'
      + nodeId
      + '/content?versionComment='+
      + encodeURI(JSON.stringify(versionComment))
      +'&mimetype='
      + encodeURI(file.type);

      try {
        var xhr: XMLHttpRequest = new XMLHttpRequest();

        // display progress
        xhr.onprogress = (progress) => {
          this.uploadMode = "determinate";
          this.uploadProgress = (progress.loaded / progress.total) * 100;
        };

        // when complete
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status === 200) {
              observer.next(xhr);
              observer.complete();
            } else {
              console.log(xhr);
              observer.error(xhr);
            }
          }
        };

        // prepare request
        const headers: Headers = new Headers();
        headers.append('Accept', 'application/json');
        headers.append('Authorization', 'Bearer' + token);
        let options = {headers:headers,withCredentials:true};
        xhr.withCredentials=options.withCredentials;
        xhr.open(method, query, true);
        for (let key of options.headers.keys()) {
          xhr.setRequestHeader(key, options.headers.get(key));
        }

        // set data
        let formData = new FormData();
        formData.append(fieldName, file, file.name);

        // sending
        xhr.send(formData);

      }catch(e){
        console.log(e);
        observer.error(e);
      }
    });
  }

}
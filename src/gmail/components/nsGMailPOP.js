Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const ExtGMailGuid = "{42040a50-44a3-11da-8cd6-0800200c9a66}";

const szVersionNumber = "V20060829100000";

/******************************  GMail ***************************************/


function nsGMail()
{
    try
    {
        var scriptLoader =  Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                                      .getService(Components.interfaces.mozIJSSubScriptLoader);
        scriptLoader.loadSubScript("chrome://web-mail/content/common/DebugLog.js");
        scriptLoader.loadSubScript("chrome://web-mail/content/common/CommonPrefs.js");
        scriptLoader.loadSubScript("chrome://web-mail/content/common/HttpComms3.js");
        scriptLoader.loadSubScript("chrome://gmail/content/GMailMSG.js");
        scriptLoader.loadSubScript("chrome://gmail/content/HTML-escape.js");

        var date = new Date();
        var szLogFileName = "GMailLog_" + date.getHours()+ "_" + date.getMinutes() + "_"+ date.getUTCMilliseconds() +"_";
        this.m_Log = new DebugLog("webmail.logging.comms", ExtGMailGuid, szLogFileName);

        this.m_Log.Write("nsGMailPOP.js " + szVersionNumber + " - Constructor - START");

        if (typeof PatternGmailConstants == "undefined")
        {
            this.m_Log.Write("nsPOPOWA.js - Constructor - loading constants");
            scriptLoader.loadSubScript("chrome://gmail/content/Gmail-Constants.js");
        }

        this.m_DomainManager =  Components.classes["@mozilla.org/GMailDomains;1"]
                                          .getService()
                                          .QueryInterface(Components.interfaces.nsIGMailDomains);


        this.m_szMailURL = "http://mail.google.com/mail/"
        this.m_bAuthorised = false;
        this.m_szUserName = null;
        this.m_szPassWord = null;
        this.m_oResponseStream = null;
        this.m_HttpComms = new HttpComms(this.m_Log);
        this.m_HttpComms.setUserAgentOverride(true);
        this.m_szIK = null;

        this.m_iStage = 0;
        this.m_szGMailAtCookie = null;
        this.m_szCookieLoginURL = null;

        this.m_aMsgDataStore = new Array();
        this.m_iTotalSize = 0;
        this.m_szLabels = "";
        this.m_szStared = false;

        this.m_ComponentManager = Components.classes["@mozilla.org/ComponentData2;1"]
                                            .getService(Components.interfaces.nsIComponentData2);

        //do i reuse the session
        var oPref = {Value:null};
        var  WebMailPrefAccess = new WebMailCommonPrefAccess();
        if (WebMailPrefAccess.Get("bool","gmail.bReUseSession",oPref))
            this.m_bReUseSession = oPref.Value;
        else
            this.m_bReUseSession = false;

        this.m_Log.Write("nsGMailPOP.js - Constructor - bReUseSession : " + this.m_bReUseSession);

        //do i download unread msg only
        oPref = {Value:null};
        if (WebMailPrefAccess.Get("bool","gmail.bDownloadUnread",oPref))
            this.m_bDownloadUnread = oPref.Value;
        else
            this.m_bDownloadUnread = true;
        this.m_Log.Write("nsGMailPOP.js - Constructor - bDownloadUnread : " + this.m_bDownloadUnread);

        //archive or delete
        oPref = {Value:null};
        if (WebMailPrefAccess.Get("bool","gmail.bArchive",oPref))
            this.m_bArchive = oPref.Value;
        else
            this.m_bArchive = true;
        this.m_Log.Write("nsGMailPOP.js - Constructor - m_bArchive : " + this.m_bArchive);

        this.m_szMsgID = 0;

        this.m_Timer = Components.classes["@mozilla.org/timer;1"];
        this.m_Timer = this.m_Timer.createInstance(Components.interfaces.nsITimer);
        this.m_iTime = 10;
        this.m_iHandleCount = 0;
        this.m_aszThreadURL = new Array();
        this.m_MSGEscape = null;
        this.m_szMsg = null;

        this.m_Log.Write("nsGMailPOP.js - Constructor - END");
    }
    catch(e)
    {
        DebugDump("nsGMailPOP.js: Constructor : Exception : "
                                      + e.name
                                      + ".\nError message: "
                                      + e.message);
    }
}


nsGMail.prototype =
{
    classDescription : "Webmail GMail POP",
    classID          : Components.ID("{38d08a80-44a3-11da-8cd6-0800200c9a66}"),
    contractID       : "@mozilla.org/GMailPOP;1",

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsISupports,
                                            Components.interfaces.nsIPOPDomainHandler]),
	
		
    get userName() {return this.m_szUserName;},
    set userName(userName) {return this.m_szUserName = userName;},

    get passWord() {return this.m_szPassWord;},
    set passWord(passWord) {return this.m_szPassWord = passWord;},

    get bAuthorised() {return this.m_bAuthorised;},

    get ResponseStream() {return this.m_oResponseStream;},
    set ResponseStream(responseStream) {return this.m_oResponseStream = responseStream;},

    logIn : function()
    {
        try
        {
            this.m_Log.Write("nsGMailPOP.js - logIN - START");
            this.m_Log.Write("nsGMailPOP.js - logIN - Username: " + this.m_szUserName
                                                   + " Password: " + this.m_szPassWord
                                                   + " stream: " + this.m_oResponseStream);

            if (!this.m_szUserName || !this.m_oResponseStream  || !this.m_szPassWord) return false;

            // get login webPage
            var szDomain = this.m_szUserName.match(/.*?@(.*?)$/)[1].toLowerCase();
            loginURL = "http://mail.google.com/mail/";
            if (szDomain == "gmail.com" || szDomain == "googlemail.com")
                loginURL = "http://mail.google.com/mail/";
            else
                loginURL = "http://mail.google.com/a/" + szDomain + "/";
           
            this.m_szMailURL = loginURL;

            this.m_HttpComms.setUserName(this.m_szUserName);

            var bSessionStored = this.m_ComponentManager.findElement(this.m_szUserName, "bSessionStored");
            if ( bSessionStored && this.m_bReUseSession )
            {
                    this.m_Log.Write("nsGMailPOP.js - logIN - Session Data found");

                    this.serverComms("+OK Your in\r\n");
                    this.m_bAuthorised = true;
            }
            else
            {
                this.m_Log.Write("nsGMailPOP.js - logIN - No Session Data found");
                var oCookies = Components.classes["@mozilla.org/nsWebMailCookieManager2;1"]
                                         .getService(Components.interfaces.nsIWebMailCookieManager2);
                oCookies.removeCookie(this.m_szUserName);
                this.m_ComponentManager.deleteAllElements(this.m_szUserName);

                this.m_HttpComms.setURI(loginURL);
                this.m_HttpComms.setRequestMethod("GET");

                var bResult = this.m_HttpComms.send(this.loginOnloadHandler, this);
                if (!bResult) throw new Error('httpConnection returned false');
                this.m_iStage = 0;
            }

            this.m_Log.Write("nsGMailPOP.js - logIN - END");
            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsGMailPOP.js: logIN : Exception : "
                                              + e.name +
                                              ".\nError message: "
                                              + e.message);
            return false;
        }
    },


    loginOnloadHandler : function(szResponse ,event , mainObject)
    {
        try
        {
            mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - START");
            mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler : " + mainObject.m_iStage);

            var httpChannel = event.QueryInterface(Components.interfaces.nsIHttpChannel);

            //if this fails we've gone somewhere new
            mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - status :" + httpChannel.responseStatus );
            if (httpChannel.responseStatus != 200)
                throw new Error("return status " + httpChannel.responseStatus);

            //bounce check or welcome page
            if (szResponse.search(patternGMailLoginBounce)!=-1 || 
            		szResponse.search(PatternGmailWelcome)!=-1)
            {
                mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - bounce/Welcome");
                var oEscape = new HTMLescape();
                var szClean = oEscape.decode(szResponse);
                delete oEscape;
                var szURI = ""
                	if (szResponse.search(PatternGmailWelcome)!=-1)
                		szURI = szClean.match(PatternGmailWelcome)[1];
                	else
                		szURI = szClean.match(patternGMailLoginBounce)[1];
                mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - redirectURL " + szURI);

                mainObject.m_HttpComms.setURI(szURI);
                mainObject.m_HttpComms.setRequestMethod("GET");
                var bResult = mainObject.m_HttpComms.send(mainObject.loginOnloadHandler, mainObject);
                if (!bResult) throw new Error("httpConnection returned false");
                return;
            }

      
            switch  ( mainObject.m_iStage )
            {
                case 0:  //login
                    mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - login");

                    var aszLoginForm = szResponse.match(patternGMailLoginForm);
                    mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - aszLoginForm " + aszLoginForm);

                    var szAction = aszLoginForm[0].match(patternGMailFormAction)[1];
                    mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - szAction " + szAction);

                    var aszInput = aszLoginForm[0].match(patternGMailFormInput);
                    mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - aszInput " + aszInput);

                    var i = 0;
                    for (i=0; i<aszInput.length; i++)
                    {
                        mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - aszInput[i] " + aszInput[i]);

                        var szName = aszInput[i].match(patternGMailFormName)[1];
                        mainObject.m_Log.Write("nsMailDotCom.js - loginOnloadHandler - szName " + szName);

                        var szValue = "";
                        try
                        {
                            var szValue = aszInput[i].match(patternGMailFormValue)[1];
                        }
                        catch (e)
                        {
                        }
                        mainObject.m_Log.Write("nsMailDotCom.js - loginOnloadHandler - szValue " + szValue);

                        if (szName.search(/Passwd/i) != -1) szValue = mainObject.m_szPassWord;
                        if (szName.search(/Email/i) != -1)
                        {
                            var szUserName = mainObject.m_szUserName.match(/(.*?)@.*?$/)[1].toLowerCase();
                            szValue = szUserName;
                        }

                        mainObject.m_HttpComms.addValuePair(szName, encodeURIComponent(szValue));
                    }

                    mainObject.m_HttpComms.setURI(szAction);
                    mainObject.m_HttpComms.setRequestMethod("POST");
                    var bResult = mainObject.m_HttpComms.send(mainObject.loginOnloadHandler, mainObject);
                    if (!bResult) throw new Error("httpConnection returned false");
                    mainObject.m_iStage++;
               break

               case 1:
                    if ( szResponse.search(/logout/i) == -1 && szResponse.search(/ManageAccount/i)==-1)
                        throw new Error("Invalid Password");

                    var szLocation  = httpChannel.URI.spec;
                    mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - location : " + szLocation );
                    	
                    mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - Getting session cookie...");
                    var IOService = Components.classes["@mozilla.org/network/io-service;1"]
                                              .getService(Components.interfaces.nsIIOService);
                    var nsIURI = IOService.newURI(szLocation, null, null);

                    var oCookies = Components.classes["@mozilla.org/nsWebMailCookieManager2;1"]
                                             .getService(Components.interfaces.nsIWebMailCookieManager2);
                   // szCookies = oCookies.findCookie(mainObject.m_szUserName, nsIURI);
                    szCookies = oCookies.findCookie(mainObject.m_szUserName, szLocation);
                    mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - session cookies:\n" + szCookies);

                    mainObject.m_szGMailAtCookie = szCookies.match(PatternGMailGetSessionCookie)[1];
                    if ( mainObject.m_szGMailAtCookie == null)
                        throw new Error("Error getting session cookie during login");

                    mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - szGMAIL_AT: " + mainObject.m_szGMailAtCookie);
                  
                    if (szLocation.search(/\?/)!= -1)
                    	mainObject.m_szMailURL = szLocation.match(/^(.*?)\?/)[1];
                    else 
                    	mainObject.m_szMailURL = szLocation;
                    mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - m_szMailURL: " + mainObject.m_szMailURL);
                    
                    mainObject.serverComms("+OK Your in\r\n");
                    mainObject.m_bAuthorised = true;
                break;
            }

            mainObject.m_Log.Write("nsGMailPOP.js - loginOnloadHandler - END");
        }
        catch(err)
        {
            var oCookies = Components.classes["@mozilla.org/nsWebMailCookieManager2;1"]
                                     .getService(Components.interfaces.nsIWebMailCookieManager2);
            oCookies.removeCookie(mainObject.m_szUserName);

            mainObject.m_ComponentManager.deleteAllElements(mainObject.m_szUserName);

            mainObject.m_Log.DebugDump("nsGMailPOP.js: loginHandler : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message
                                          + "\n" + err.lineNumber);

            mainObject.serverComms("-ERR negative vibes (GMail)\r\n");
        }
    },



    //stat
    //total size is in octets
    getNumMessages : function()
    {
        try
        {
            this.m_Log.Write("nsGMailPOP.js - getNumMessages - START");

            if ( this.m_bAuthorised == false ) return false;

            var szInboxURI = this.m_szMailURL + "?search=inbox&view=tl&start=0&init=1&ui=1"
            this.m_HttpComms.setURI(szInboxURI);
            this.m_HttpComms.setRequestMethod("GET");
            var bResult = this.m_HttpComms.send(this.mailBoxOnloadHandler, this);
            if (!bResult) throw new Error("httpConnection returned false");
            this.m_iStage = 0;

            this.m_Log.Write("nsGMailPOP.js - getNumMessages - END");
            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsGMailPOP.js: getNumMessages : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message);
            return false;
        }
    },




    mailBoxOnloadHandler : function (szResponse ,event , mainObject)
    {
        try
        {
            mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - START");
            mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler : " + mainObject.m_iStage);

            var httpChannel = event.QueryInterface(Components.interfaces.nsIHttpChannel);

            //check status should be 200.
            mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - Mailbox :" + httpChannel.responseStatus);
            if (httpChannel.responseStatus != 200 )
                throw new Error("error status " + httpChannel.responseStatus);

            switch(mainObject.m_iStage)
            {
                case 0:
                    mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - process pages ");
                    var aMSGTableURLs = szResponse.match(PatternGMailNextMSGTable);
                    mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - aMSGTableURLs :" + aMSGTableURLs);
                    if (aMSGTableURLs)
                    {
                    	if (!mainObject.m_szIK)
                    	{
	                    	try
	                    	{
		                        mainObject.m_szIK = szResponse.match(PatternGMailIKAlt)[1];
		                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - szIK :" + mainObject.m_szIK);
	                    	}
	                    	catch(err)
	                    	{ 
	                    		mainObject.m_szIK = szResponse.match(PatternGMailIK)[1];
		                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - szIK Alt:" + mainObject.m_szIK);                    		
	                    	}
                    	}
                        var iNumEmails = parseInt(aMSGTableURLs[2]);
                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - iNumEmails :" + iNumEmails);

                        var szMSGTable = szResponse.match(PatternGMailMSGTable)[0];
                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - szMSGTable :\n" + szMSGTable);

                        var aszBlock = szMSGTable.match(PatternGmailMSGTableBlock);
                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - aszBlock :\n" + aszBlock);

                        if (aszBlock)
                        {
                        	var i = 0;
                            for (i=0; i<aszBlock.length; i++)
                            {
                                var szData = aszBlock[i].replace(/\[".*?",\d*,\[/,"");
                                aszData = szData.match(PatternGMailMSGData);
                                mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - szData : " + aszData);

                                var bRead = true;
                                if (mainObject.m_bDownloadUnread)
                                {
                                    bRead = parseInt(aszData[3])==1 ? false : true;
                                    this.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler- bRead -" + bRead);
                                }

                                if (bRead)
                                {
                                    //check for thread
                                    if (aszData[1]!=aszData[2])
                                    {//thread found
                                         mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - thread found");
                                         var szThreadURI = mainObject.m_szMailURL + "?ui=2&view=cv&search=inbox&mb=0&rt=j";
                                         szThreadURI +="&ik=" + mainObject.m_szIK;
                                         szThreadURI += "&th=" + aszData[1];
                                         mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - szThreadURI :" +szThreadURI);
                                         mainObject.m_aszThreadURL.push(szThreadURI);
                                         iNumEmails--;
                                    }
                                    else
                                    { //no thread
                                        var data = new GMailMSG();
                                        data.szMsgID = aszData[1];
                                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - ID :" + data.szMsgID);

                                        data.bStared = parseInt(aszData[4])==1 ? true : false;
                                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - stared :" + data.bStared);

                                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - aszData[5] : " + aszData[5]);
                                        if(aszData[5].length>0)
                                        {
                                            var szLabels = "";
                                            var aszLabels = aszData[5].match(/"(.*?)"/g);
                                            var k = 0;
                                            for (k=0; k<aszLabels.length; k++)
                                            {
                                                if (aszLabels[k].search(/^"\^\S"$/)==-1)
                                                {
                                                    szLabels += aszLabels[k];
                                                    if (k<aszLabels.length-1)szLabels += ", ";
                                                }
                                            }
                                            data.szLabels = (szLabels)? szLabels : " ";
                                        }
                                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - label :" + data.szLabels);

                                        data.iSize = 100000;
                                        mainObject.m_iTotalSize += data.iSize;
                                        mainObject.m_aMsgDataStore.push(data);
                                    }
                                }
                            }
                        }
                    }

                    if (mainObject.m_aszThreadURL.length > 0)
                    {
                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - now download threads");
                        var szURL = mainObject.m_aszThreadURL.pop();
                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - szURL " + szURL);
                        mainObject.m_HttpComms.setURI(szURL);
                        mainObject.m_HttpComms.setRequestMethod("GET");
                        var bResult= mainObject.m_HttpComms.send(mainObject.mailBoxOnloadHandler, mainObject);
                        if (!bResult) throw new Error("httpConnection returned false");
                        mainObject.m_iStage = 1;
                    }
                    else
                    {
                        mainObject.serverComms("+OK "+
                                               mainObject.m_aMsgDataStore.length + " " +
                                               mainObject.m_iTotalSize + "\r\n");
                    }
                break;

                case 1:
                    mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - process threads ");

                    var aThreadTable = szResponse.match(PatternGMailThreadTableBlock);
                    mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - aThreadTable :" + aThreadTable);

                    var i = 0;
                    for (i=0; i<aThreadTable.length; i++)
                    {
                        var aEmailData = aThreadTable[i].match(PatternGMailThreadTableData);
                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - aEmailData :" + aEmailData);

                        if (parseInt(aEmailData[2])!= 1) //1 are deleted emails ?
                        {
                            //check your not sender
                            //aEmailData[5] sender's email address != account email
                            mainObject.m_szUserName
                            var regExp = new RegExp(aEmailData[3]);
                            if ( mainObject.m_szUserName.search(regExp)==-1)//sent items?
                            {
                                var data = new GMailMSG();
                                data.szMsgID = aEmailData[1];
                                mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - ID :" + data.szMsgID);

                                data.iSize = 100000;
                                mainObject.m_iTotalSize += data.iSize;
                                mainObject.m_aMsgDataStore.push(data);
                            }
                            else
                                mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - You sent this ");
                        }
                        else
                            mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - This has been deleted ");
                    }

                    if (mainObject.m_aszThreadURL.length > 0)
                    {
                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - now download threads");
                        var szURL = mainObject.m_aszThreadURL.pop();
                        mainObject.m_Log.Write("nsGMailPOP.js - mailBoxOnloadHandler - szURL " + szURL);
                        mainObject.m_HttpComms.setURI(szURL);
                        mainObject.m_HttpComms.setRequestMethod("GET");
                        var bResult= mainObject.m_HttpComms.send(mainObject.mailBoxOnloadHandler, mainObject);
                        if (!bResult) throw new Error("httpConnection returned false");
                        mainObject.m_iStage = 1;
                    }
                    else  //done
                    {
                        mainObject.serverComms("+OK "+
                                               mainObject.m_aMsgDataStore.length + " " +
                                               mainObject.m_iTotalSize + "\r\n");
                    }
                break;
            }

            mainObject.m_Log.Write("nsGMailPOP.js - MailBoxOnload - END");
        }
        catch(err)
        {
             mainObject.m_Log.DebugDump("nsGMailPOP.js: MailboxOnload : Exception : "
                                              + err.name
                                              + ".\nError message: "
                                              + err.message
                                              + "\n" + err.lineNumber);

             mainObject.serverComms("-ERR negative vibes (GMail)\r\n");
        }
    },





    //list
    //I'm not downloading the mailbox again.
    //I hope stat been called first or there's going to be trouble
    getMessageSizes : function()
    {
        try
        {
            this.m_Log.Write("nsGMailPOP.js - getMessageSizes - START");

            if ( this.m_bAuthorised == false ) return false;

            var callback = {
               notify: function(timer) { this.parent.processSizes(timer)}
            };
            callback.parent = this;

            this.m_iHandleCount = 0;
            this.m_Timer.initWithCallback(callback,
                                          this.m_iTime,
                                          Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);

            this.m_Log.Write("nsGMailPOP.js - getMessageSizes - END");
            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsGMailPOP.js: getMessageSizes : Exception : "
                        + e.name
                        + ".\nError message: "
                        + e.message + "\n"
                        + e.lineNumber);
            return false;
        }
    },




    processSizes : function(timer)
    {
        try
        {
            this.m_Log.Write("nsGMailPOP.js - processSizes - START");

            //response start
            if (this.m_iHandleCount ==  0)
                this.serverComms("+OK " + this.m_aMsgDataStore.length + " Messages\r\n")


            if ( this.m_aMsgDataStore.length > 0)
            {
                var iCount = 0;
                do{
                    var iEmailSize = this.m_aMsgDataStore[this.m_iHandleCount].iSize;
                    this.serverComms((this.m_iHandleCount+1) + " " + iEmailSize + "\r\n");
                    this.m_iHandleCount++;
                    iCount++;
                }while(iCount != this.m_iProcessAmount && this.m_iHandleCount!=this.m_aMsgDataStore.length)
            }

            //response end
            if (this.m_iHandleCount == this.m_aMsgDataStore.length)
            {
              this.serverComms(".\r\n");
              timer.cancel();
            }

            this.m_Log.Write("nsGMailPOP.js - processSizes - END");
        }
        catch(err)
        {
            this.m_Timer.cancel();
            this.m_Log.DebugDump("nsGMailPOP.js: processSizes : Exception : "
                                              + err.name
                                              + ".\nError message: "
                                              + err.message+ "\n"
                                              + err.lineNumber);

            this.serverComms("-ERR negative vibes from " +this.m_szUserName+ "\r\n");
        }
    },





    //IUDL
    getMessageIDs : function()
    {
        try
        {
            this.m_Log.Write("nsGMailPOP.js - getMessageIDs - START");

            if ( this.m_bAuthorised == false ) return false;

            var callback = {
               notify: function(timer) { this.parent.processIDS(timer)}
            };
            callback.parent = this;
            this.m_iHandleCount = 0;
            this.m_Timer.initWithCallback(callback,
                                          this.m_iTime,
                                          Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);


            this.m_Log.Write("nsGMailPOP.js - getMessageIDs - END");
            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsGMailPOP.js: getMessageIDs : Exception : "
                                              + e.name
                                              + ".\nError message: "
                                              + e.message);
            return false;
        }
    },




    processIDS : function(timer)
    {
        try
        {
            this.m_Log.Write("nsGMailPOP.js - processIDS - START");

            //response start
            if (this.m_iHandleCount ==  0)
                this.serverComms("+OK " + this.m_aMsgDataStore.length + " Messages\r\n");


            if ( this.m_aMsgDataStore.length > 0)
            {
                var iCount = 0;
                do{
                    var szEmailID = this.m_aMsgDataStore[this.m_iHandleCount].szMsgID;
                    this.m_Log.Write("nsGMailPOP.js - getMessageIDs - IDS : " +szEmailID);

                    this.serverComms((this.m_iHandleCount+1) + " " + szEmailID + "\r\n");
                    this.m_iHandleCount++;
                    iCount++;
                }while(iCount != this.m_iProcessAmount && this.m_iHandleCount!=this.m_aMsgDataStore.length)
            }


            //response end
            if (this.m_iHandleCount == this.m_aMsgDataStore.length)
            {
                this.serverComms(".\r\n");
                timer.cancel();
            }

            this.m_Log.Write("nsGMailPOP.js - processIDS - END");
        }
        catch(err)
        {
            this.m_Timer.cancel();
            this.m_Log.DebugDump("nsGMailPOP.js: processIDS : Exception : "
                                              + err.name
                                              + ".\nError message: "
                                              + err.message+ "\n"
                                              + err.lineNumber);

            this.serverComms("-ERR negative vibes from " +this.m_szUserName+ "\r\n");
        }
    },




    //retr
    getMessage : function(msgIndex)
    {
        try
        {
            this.m_Log.Write("nsGMailPOP.js - getMessage - START");

            if ( this.m_bAuthorised == false ) return false;

            //get msg id
            var oMSGData = this.m_aMsgDataStore[msgIndex-1]
            this.m_szMsgID = oMSGData.szMsgID;
            this.m_Log.Write("nsGMailPOP.js - getMessage - msg id: " + this.m_szMsgID);

            this.m_szLabels = (oMSGData.szLabels)? oMSGData.szLabels :  " ";
            this.m_Log.Write("nsGMailPOP.js - getMessage - msg m_szLabels: " + this.m_szLabels);

            this.m_bStared = oMSGData.bStared;
            this.m_Log.Write("nsGMailPOP.js - getMessage - msg m_szStared: " + this.m_szStared);


            var getMsgParams = "&ui=2&view=om&th=" + this.m_szMsgID +"&ik=" + this.m_szIK ;
            var szInboxURI = this.m_szMailURL + '?' + getMsgParams;

            this.m_iStage = 0;
            this.m_HttpComms.setURI(szInboxURI);
            this.m_HttpComms.setRequestMethod("GET");
            var bResult = this.m_HttpComms.send(this.emailOnloadHandler, this);
            if (!bResult) throw new Error("httpConnection returned false");

            this.m_Log.Write("nsGMailPOP.js - getMessage - END");
            return true;
        }
        catch(e)
        {
             this.m_Log.DebugDump("nsGMailPOP.js: getMessage : Exception : "
                                          + e.name +
                                          ".\nError message: "
                                          + e.message);
            return false;
        }
    },


    emailOnloadHandler : function (szResponse ,event , mainObject)
    {
        try
        {
            mainObject.m_Log.Write("nsGMailPOP.js - emailOnloadHandler - START");

            var httpChannel = event.QueryInterface(Components.interfaces.nsIHttpChannel);
            //check status should be 200.
            if (httpChannel.responseStatus != 200)
                throw new Error("error status " + httpChannel.responseStatus);

            var szContetnType =  httpChannel.getResponseHeader("Content-Type");
            mainObject.m_Log.Write("nsGMailPOP.js - emailOnloadHandler - szContetnType "+szContetnType);
           /* if (szContetnType.search(/text\/html/i)!=-1)
               throw new Error("Unexpected reply from GMail; " + szResponse); */
          /*
            var szMsg =  "X-WebMail: true\r\n";
            szMsg +=  "X-Labels: " + mainObject.m_szLabels + "\r\n";
            szMsg +=  "X-Stared: " + mainObject.m_bStared;
            szMsg += szResponse;
            szMsg += "\r\n.\r\n";  //msg end
            
            var szPOPResponse = "+OK " +  szMsg.length + "\r\n";
            szPOPResponse +=  szMsg;
            mainObject.serverComms(szPOPResponse);
            
*/
            switch(mainObject.m_iStage)
            {
                case 0: //get email
                 	mainObject.m_szMsg =  "X-WebMail: true\r\n";
		            mainObject.m_szMsg +=  "X-Labels: " + mainObject.m_szLabels + "\r\n";
		            mainObject.m_szMsg +=  "X-Stared: " + mainObject.m_bStared;
		            mainObject.m_szMsg += szResponse;
		            mainObject.m_szMsg += "\r\n.\r\n";  //msg end
		           //https://mail.google.com/mail/u/0/?&ui=2&view=om&at=13639d7969ba0264&ik=47ff1a6c53&act=rd
                   //https://mail.google.com/mail/?ui=2&ik=39330b98b6&at=AF6bupONxSiIfVYhXpKoAbmBHqeGp7gzPw&act=rd

		            var szMarkAsReadURI = mainObject.m_szMailURL;
		            szMarkAsReadURI += "?search=inbox&ui=2";
		            szMarkAsReadURI += "&view=up";
		            szMarkAsReadURI += "&act=rd";
		            szMarkAsReadURI += "&at=" + mainObject.m_szGMailAtCookie;
		            szMarkAsReadURI += "&ik=" + mainObject.m_szIK;

		            mainObject.m_HttpComms.addValuePair("t", mainObject.m_szMsgID);
		            		            
		            mainObject.m_iStage = 1;
		            mainObject.m_HttpComms.setURI(szMarkAsReadURI);
		            mainObject.m_HttpComms.setRequestMethod("POST");
		            var bResult = mainObject.m_HttpComms.send(mainObject.emailOnloadHandler, mainObject);
		            if (!bResult) throw new Error("httpConnection returned false") 
                break;

                case 1: //mark as read
                    var szPOPResponse = "+OK " +  mainObject.m_szMsg.length + "\r\n";
                    szPOPResponse +=  mainObject.m_szMsg;
                    mainObject.serverComms(szPOPResponse);
                break;
            }

            mainObject.m_Log.Write("nsGMailPOP.js - emailOnloadHandler - END");
        }
        catch(err)
        {
            mainObject.m_Log.DebugDump("nsGMailPOP.js: emailOnloadHandler : Exception : "
                                              + err.name
                                              + ".\nError message: "
                                              + err.message);
            mainObject.serverComms("-ERR negative vibes (GMail)\r\n");
        }
    },



    emailCleanCallback : function (szEmail, mainObject)
    {
        try
        {
            mainObject.m_Log.Write("nsGMailPOP - emailCleanCallback - START");

            mainObject.m_szMsg =  "X-WebMail: true\r\n";
            mainObject.m_szMsg +=  "X-Labels: " + mainObject.m_szLabels + "\r\n";
            mainObject.m_szMsg +=  "X-Stared: " + mainObject.m_bStared;
            mainObject.m_szMsg += szEmail;
            mainObject.m_szMsg =  mainObject.m_szMsg.replace(/^\./mg,"..");    //bit padding
            mainObject.m_szMsg += "\r\n.\r\n";  //msg end

            mainObject.m_iStage++;

            var szURL = mainObject.m_szMailURL ;
            szURL += "?search=inbox&ui=2";
            szURL += "&view=up";
            szURL += "&act=rd";
            szURL += "&at=" + mainObject.m_szGMailAtCookie;
            szURL += "&ik=" + mainObject.m_szIK;

            mainObject.m_HttpComms.addValuePair("t", mainObject.m_szMsgID);

            mainObject.m_HttpComms.setURI(szURL);
            mainObject.m_HttpComms.setRequestMethod("POST");
            var bResult = mainObject.m_HttpComms.send(mainObject.emailOnloadHandler, mainObject);
            if (!bResult) throw new Error("httpConnection returned false");

            mainObject.m_Log.Write("nsGMailPOP - emailCleanCallback - END");
        }
        catch(e)
        {
            mainObject.m_Log.DebugDump("Hotmail-SR-BETA: emailCleanCallback : Exception : "
                                          + e.name +
                                          ".\nError message: "
                                          + e.message+ "\n"
                                          + e.lineNumber);
            mainObject.serverComms("-ERR negative vibes from " +mainObject.m_szUserName+ "\r\n");
        }
    },


    //dele
    deleteMessage : function(msgIndex)
    {
        try
        {
            this.m_Log.Write("nsGMailPOP.js - deleteMessage - START");

            if ( this.m_bAuthorised == false ) return false;

            //get msg id
            var oMSGData = this.m_aMsgDataStore[msgIndex-1]
            this.m_szMsgID = oMSGData.szMsgID;
            this.m_Log.Write("nsGMailPOP.js - deleteMessage - msg id: " + this.m_szMsgID);

            var szDeleteMsgURL = this.m_szMailURL ;
            szDeleteMsgURL += "?search=inbox&ui=2";
            szDeleteMsgURL += "&view=up";
            szDeleteMsgURL += this.m_bArchive ? "&act=rc_%5Ei" : "&act=tr";
            szDeleteMsgURL += "&at=" + this.m_szGMailAtCookie;
            szDeleteMsgURL += "&ik=" + this.m_szIK;

            this.m_HttpComms.addValuePair("t", this.m_szMsgID);

            this.m_HttpComms.setURI(szDeleteMsgURL);
            this.m_HttpComms.setRequestMethod("POST");
            var bResult = this.m_HttpComms.send(this.deleteMessageOnloadHandler, this);
            this.m_iStage = 0;

            this.m_Log.Write("nsGMailPOP.js - deleteMessage - END");
            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsGMailPOP.js: deleteMessage : Exception : "
                                          + e.name +
                                          ".\nError message: "
                                          + e.message);
            return false;
        }
    },


    deleteMessageOnloadHandler : function (szResponse ,event , mainObject)
    {
        try
        {
            mainObject.m_Log.Write("nsGMailPOP.js - deleteMessageOnload - START");

            var httpChannel = event.QueryInterface(Components.interfaces.nsIHttpChannel);
            //check status should be 200.
            mainObject.m_Log.Write("nsGMailPOP.js - deleteMessageOnload :" + httpChannel.responseStatus);
            if (httpChannel.responseStatus != 200 )
                throw new Error("error status " + httpChannel.responseStatus);

            mainObject.serverComms("+OK its history\r\n");
            mainObject.m_Log.Write("nsGMailPOP.js - deleteMessageOnload - END");
        }
        catch(e)
        {
            mainObject.m_Log.DebugDump("nsGMailPOP.js: deleteMessageOnload : Exception : " + e.name
                                                  + ".\nError message: "
                                                  + e.message);
            mainObject.serverComms("-ERR negative vibes (GMail)\r\n");
        }
    },

    //cookies are deleted when the connection ends so i dont need to download pages
    logOut : function()
    {
        try
        {
            this.m_Log.Write("nsGMailPOP.js - logOUT - START");

            if ( this.m_bReUseSession)
            {
                this.m_Log.Write("nsGMailSMTP.js - logOUT - Saving session Data");
                this.m_ComponentManager.addElement(this.m_szUserName, "bSessionStored", true);
            }
            else
            {
                var oCookies = Components.classes["@mozilla.org/nsWebMailCookieManager2;1"]
                                         .getService(Components.interfaces.nsIWebMailCookieManager2);
                oCookies.removeCookie(this.m_szUserName);

                this.m_ComponentManager.deleteAllElements(this.m_szUserName);
            }

            this.m_bAuthorised = false;
            this.serverComms("+OK Your Out\r\n");

            this.m_Log.Write("nsGMailPOP.js - logOUT - END");
            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsGMailPOP.js: logOUT : Exception : "
                                      + e.name
                                      + ".\nError message: "
                                      + e.message);
            return false;
        }
    },

    serverComms : function (szMsg)
    {
        try
        {
            this.m_Log.Write("nsGMailPOP.js - serverComms - START");
            this.m_Log.Write("nsGMailPOP.js - serverComms msg " + szMsg);
            var iCount = this.m_oResponseStream.write(szMsg,szMsg.length);
            this.m_Log.Write("nsGMailPOP.js - serverComms sent count: " + iCount +" msg length: " +szMsg.length);
            this.m_Log.Write("nsGMailPOP.js - serverComms - END");
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsGMailPOP.js: serverComms : Exception : "
                                              + e.name
                                              + ".\nError message: "
                                              + e.message);
        }
    }
};

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsGMail]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsGMail]);


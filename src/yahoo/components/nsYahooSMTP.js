Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const ExtYahooGuid = "{d7103710-6112-11d9-9669-0800200c9a66}";

/******************************  Yahoo ***************************************/
function nsYahooSMTP()
{
    try
    {
        var scriptLoader =  Components.classes["@mozilla.org/moz/jssubscript-loader;1"];
        scriptLoader = scriptLoader.getService(Components.interfaces.mozIJSSubScriptLoader);

        scriptLoader.loadSubScript("chrome://web-mail/content/common/DebugLog.js");
        scriptLoader.loadSubScript("chrome://web-mail/content/common/CommonPrefs.js");
       // scriptLoader.loadSubScript("chrome://yahoo/content/Yahoo-SMTP.js");
        scriptLoader.loadSubScript("chrome://yahoo/content/Yahoo-SMTP-Beta.js");
       // scriptLoader.loadSubScript("chrome://yahoo/content/Yahoo-SMTP-Classic.js");
        scriptLoader.loadSubScript("chrome://yahoo/content/Yahoo-Prefs-Accounts-Data.js");

        var date = new Date();
        var  szLogFileName = "Yahoo SMTP Log - " + date.getHours() + "-" + date.getMinutes() + "-"+ date.getUTCMilliseconds() +" -";
        this.m_Log = new DebugLog("webmail.logging.comms", ExtYahooGuid, szLogFileName);

        this.m_Log.Write("nsYahooSMTP.js - Constructor - START");

        if (typeof kYahooConstants == "undefined")
        {
            this.m_Log.Write("nsYahooSMTP.js - Constructor - loading constants");
            scriptLoader.loadSubScript("chrome://yahoo/content/Yahoo-Constants.js");
        }

        this.m_bAuthorised = false;
        this.m_szUserName = null;
        this.m_szPassWord = null;
        this.m_oResponseStream = null;
        this.m_CommMethod = null;
        this.m_aszTo = new Array();
        this.m_szFrom = null;

        this.m_Log.Write("nsYahooSMTP.js - Constructor - END");
    }
    catch(e)
    {
        DebugDump("nsYahooSMTP.js: Constructor : Exception : "
                                      + e.name
                                      + ".\nError message: "
                                      + e.message +"\n"
                                      + e.lineNumber);
    }
}



nsYahooSMTP.prototype =
{

    classDescription : "Webmail Yahoo mail SMTP",
    classID          : Components.ID("{958266e0-e2a6-11d9-8cd6-0800200c9a66}"),
    contractID       : "@mozilla.org/YahooSMTP;1",

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsISupports,
                                            Components.interfaces.nsISMTPDomainHandler]),

    get userName() {return this.m_szUserName;},
    set userName(userName) {return this.m_szUserName = userName;},

    get passWord() {return this.m_szPassWord;},
    set passWord(passWord) {return this.m_szPassWord = passWord;},

    get bAuthorised()
    {
        return (this.m_CommMethod)? this.m_CommMethod.m_bAuthorised: false;
    },

    get ResponseStream() {return this.m_oResponseStream;},
    set ResponseStream(responseStream) {return this.m_oResponseStream = responseStream;},

    get to() {return this.m_aszTo;},
    set to(szAddress) {return this.m_aszTo.push(szAddress);},

    get from() {return this.m_szFrom;},
    set from(szAddress) {return this.m_szFrom = szAddress;},


    logIn : function()
    {
        try
        {
            this.m_Log.Write("nsYahooSMTP.js - logIN - START");
            this.m_Log.Write("nsYahooSMTP.js - logIN - Username: " + this.m_szUserName
                                                   + " Password: " + this.m_szPassWord
                                                   + " stream: " + this.m_oResponseStream);

            if (!this.m_szUserName || !this.m_oResponseStream  || !this.m_szPassWord) return false;


            //get prefs
            var oData = this.loadPrefs();
            //use beta site
            this.m_CommMethod = new YahooSMTPBETA(this.m_oResponseStream, this.m_Log, oData);

            var bResult = this.m_CommMethod.logIn(this.m_szUserName, this.m_szPassWord);

            this.m_Log.Write("nsYahooSMTP.js - logIN - END");
            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsYahooSMTP.js: logIN : Exception : "
                                              + e.name +
                                              ".\nError message: "
                                              + e.message+ "\n"
                                              + e.lineNumber);

            this.serverComms("502 negative vibes from "+this.m_szUserName+"\r\n");

            return false;
        }
    },


    rawMSG : function (szEmail)
    {
        try
        {
            this.m_Log.Write("nsYahooSMTP.js - rawMSG - START");
            this.m_Log.Write("nsYahooSMTP.js - rawMSG from " +this.m_szFrom );
            this.m_Log.Write("nsYahooSMTP.js - rawMSG to " +this.m_aszTo );
            this.m_Log.Write("nsYahooSMTP.js - rawMSG " + szEmail);

            var bResult = this.m_CommMethod.rawMSG(this.m_szFrom, this.m_aszTo, szEmail);

            this.m_Log.Write("nsHotmailSMTP.js - rawMSG -" + bResult +" END");
            return bResult;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsYahooSMTP.js: rawMSG : Exception : "
                                              + err.name +
                                              ".\nError message: "
                                              + err.message+ "\n"
                                              + err.lineNumber);
            return false;
        }
    },




    loadPrefs : function()
    {
        try
        {
            this.m_Log.Write("nsYahooSMTP.js - loadPrefs - START");

            var szUserName =  this.m_szUserName;
            szUserName = szUserName.replace(/\./g,"~");
            szUserName = szUserName.toLowerCase();

            //get user prefs
            var oData = new PrefData();
            var oPref = {Value:null};
            var  WebMailPrefAccess = new WebMailCommonPrefAccess();


            //do i reuse the session
            if (WebMailPrefAccess.Get("bool","yahoo.Account."+szUserName +"bReUseSession",oPref))
                oData.bReUseSession = oPref.Value;

            //do i save copy
            oPref.Value = null;
            if (WebMailPrefAccess.Get("bool","yahoo.Account."+szUserName+".bSaveCopy",oPref))
                oData.bSaveCopy=oPref.Value;
            this.m_Log.Write("nsYahooSMTP.js - getPrefs - bSaveCopy " + oPref.Value);

            //do i use html part
            oPref.Value = null;
            if (WebMailPrefAccess.Get("bool","yahoo.Account."+szUserName+".bSendHtml",oPref))
                oData.bSendHtml=oPref.Value;
            this.m_Log.Write("nsYahooSMTP.js - getPrefs - bSendHtml " + oPref.Value);

            //use yahoo beta site
            oPref.Value = null;
            if (WebMailPrefAccess.Get("bool","yahoo.Account."+szUserName+".bBeta",oPref))
               oData.bBeta=oPref.Value;
            this.m_Log.Write("nsYahooSMTP.js - getPrefs - bBeta " + oPref.Value);

            //use yahoo classic site
            oPref.Value = null;
            if (WebMailPrefAccess.Get("bool","yahoo.Account."+szUserName+".bClassic",oPref))
                oData.bClassic=oPref.Value;
            this.m_Log.Write("nsYahooSMTP.js - loadPrefs - bClassic " + oPref.Value);

            this.m_Log.Write("nsYahooSMTP.js - loadPrefs - END");
            return oData;
        }
        catch(e)
        {
             this.m_Log.DebugDump("nsYahooSMTP.js: loadPrefs : Exception : "
                                              + e.name +
                                              ".\nError message: "
                                              + e.message+ "\n"
                                              + e.lineNumber);
            return null;
        }
    },






    ////////////////////////////////////////////////////////////////////////////
    /////  Comms

    serverComms : function (szMsg)
    {
        try
        {
            this.m_Log.Write("nsYahooSMTP.js - serverComms - START");
            this.m_Log.Write("nsYahooSMTP.js - serverComms msg " + szMsg);
            var iCount = this.m_oResponseStream.write(szMsg,szMsg.length);
            this.m_Log.Write("nsYahooSMTP.js - serverComms sent count: " + iCount
                                                        +" msg length: " +szMsg.length);
            this.m_Log.Write("nsYahooSMTP.js - serverComms - END");
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsYahooSMTP.js: serverComms : Exception : "
                                              + e.name
                                              + ".\nError message: "
                                              + e.message+ "\n"
                                              + e.lineNumber);
        }
    }
};

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsYahooSMTP]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsYahooSMTP]);


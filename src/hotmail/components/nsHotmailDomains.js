Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const nsHotmailExtGUID = "{3c8e8390-2cf6-11d9-9669-0800200c9a66}";



/***********************  UriManager ********************************/
function nsHotmailDomains()
{
    this.m_scriptLoader = null;
    this.m_Log = null;
    this.m_DomainManager = null;
    this.m_Timer = null;
    this.m_iCount = 0;
    this.m_aszDomain = ["hotmail.com", "msn.com"      , "hotmail.it"    , "hotmail.fr",
                        "hotmail.de" , "hotmail.co.jp", "hotmail.co.uk" , "msn.co.uk",
                        "live.com"   , "live.fr"      , "live.de"       , "live.co.uk",
                        "live.ie"    , "live.nl"      , "live.com.au"];

}


nsHotmailDomains.prototype =
{
    classDescription : "Webmail Hotmail mail Domains",
    classID          : Components.ID("{edaa9400-fbe6-11da-974d-0800200c9a66}"),
    contractID       : "@mozilla.org/HotmailDomains;1",
    _xpcom_categories: [{category: "profile-after-change", service: true}],

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                            Components.interfaces.nsISupports,
                                            Components.interfaces.nsIHotmailDomains]),


    loadStandardData : function()
    {
        try
        {
            this.m_Log.Write("nsHotmailDomains.js - loadDataBase - START");

            //assume DB not ready start timer
            this.m_Timer = Components.classes["@mozilla.org/timer;1"]
                                    .createInstance(Components.interfaces.nsITimer);
            this.m_Timer.initWithCallback(this,
                                          250,
                                          Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);

            this.m_Log.Write("nsHotmailDomains.js - loadDataBase - END");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsHotmailDomains.js: loadDataBase : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber);

            return false;
        }
    },

        
    notify: function(timer)
    {
        try
        {
            this.m_Log.Write("nsHotmailDomains.js : TimerCallback -  START");

            if(!this.m_DomainManager.isReady())
            {
                this.m_Log.Write("nsHotmailDomains.js : TimerCallback -  db not ready");
                return;
            }

            if (this.m_iCount == 0)  //register content_id and extension guid
            {
                this.m_DomainManager.registerDomainHandler("@mozilla.org/HotmailPOP;1", nsHotmailExtGUID);
                this.m_DomainManager.registerDomainHandler("@mozilla.org/HotmailSMTP;1",nsHotmailExtGUID);
            }

            if (this.m_iCount< this.m_aszDomain.length)
            {
                if (!this.domainCheck( this.m_aszDomain[this.m_iCount], "POP", "@mozilla.org/HotmailPOP;1"))
                    this.m_DomainManager.newDomain(this.m_aszDomain[this.m_iCount], "POP", "@mozilla.org/HotmailPOP;1","true");
                if (!this.domainCheck(this.m_aszDomain[this.m_iCount], "SMTP", "@mozilla.org/HotmailSMTP;1"))
                    this.m_DomainManager.newDomain(this.m_aszDomain[this.m_iCount], "SMTP", "@mozilla.org/HotmailSMTP;1","true");
            }
            else
                timer.cancel();

            this.m_iCount++;

            this.m_Log.Write("nsHotmailDomains.js : TimerCallback - END");
        }
        catch(e)
        {
            this.m_Timer.cancel();
            this.m_Log.DebugDump("nsHotmailDomains.js : TimerCallback - Exception in notify : "
                                        + e.name +
                                        ".\nError message: "
                                        + e.message + "\n"
                                        + e.lineNumber);
        }
    },
    
   
    domainCheck : function (szDomain,szProtocol, szHotmailContentID)
    {
        try
        {
            this.m_Log.Write("nsHotmailDomains.js - domainCheck - START ");
            this.m_Log.Write("nsHotmailDomains.js - domainCheck - " +szDomain + " " + szProtocol + " " + szHotmailContentID);

            var bFound = false;
            var szContentID = new Object;
            var bDefault = new Object;
            if (this.m_DomainManager.newDomain(szDomain,szProtocol, szContentID, bDefault))
            {
                //check content id and defalut status
                if (szContentID.value == szHotmailContentID && bDefault.value == true)
                    bFound = true;
            }

            this.m_Log.Write("nsHotmailDomains.js - domainCheck - END " + bFound);
            return bFound;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsHotmailDomains.js: domainCheck : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber);

            return false;
        }
    },
    
    
    observe : function(aSubject, aTopic, aData)
    {
        switch(aTopic)
        {
            case "profile-after-change":
                // This happens after profile has been loaded and user preferences have been read.
                // startup code here
                var obsSvc = Components.classes["@mozilla.org/observer-service;1"]
                                         .getService(Components.interfaces.nsIObserverService);
                obsSvc.addObserver(this, "quit-application", false);
                obsSvc.addObserver(this, "em-action-requested", false);

                this.m_scriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                                                .getService(Components.interfaces.mozIJSSubScriptLoader);
                this.m_scriptLoader.loadSubScript("chrome://web-mail/content/common/DebugLog.js");
                this.m_scriptLoader.loadSubScript("chrome://web-mail/content/common/CommonPrefs.js");
                this.m_Log = new DebugLog("webmail.logging.comms",
                                          "{3c8e8390-2cf6-11d9-9669-0800200c9a66}",
                                          "HotmailDomainsLog");
                try
                {
                    this.m_DomainManager = Components.classes["@mozilla.org/DomainManager;1"]
                                                     .getService()
                                                     .QueryInterface(Components.interfaces.nsIDomainManager);
                }
                catch(err)
                {
                    this.m_Log.Write("nsHotmailDomains.js - domainmanager not found");
                }

                this.loadStandardData();
            break;


            case "em-action-requested":
                this.m_Log.Write("nsHotmailDomains.js - em-action-requested ");
                aSubject.QueryInterface(Components.interfaces.nsIUpdateItem);

                if (aData == "item-uninstalled" && aSubject.id == nsHotmailExtGUID)
                {
                    this.m_Log.Write("nsHotmailDomains.js - Hotmail is being uninstalled ");
                    var prefAccess = new WebMailCommonPrefAccess();
                    prefAccess.DeleteBranch("hotmail.domains.version");
                }
            break;


            case "quit-application":
                this.m_Log.Write("nsHotmailDomains.js - quit-application ");
                if (this.m_bChange) this.saveData();

                var obsSvc = Components.classes["@mozilla.org/observer-service;1"]
                                       .getService(Components.interfaces.nsIObserverService);
                obsSvc.removeObserver(this, "profile-after-change");
                obsSvc.removeObserver(this, "quit-application");
                obsSvc.removeObserver(this, "em-action-requested");
            break;

            default:
                throw Components.Exception("Unknown topic: " + aTopic);
        }
    }
};


/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsHotmailDomains]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsHotmailDomains]);
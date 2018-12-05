Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const nsYahooExtGUID = "{d7103710-6112-11d9-9669-0800200c9a66}";

/***********************  UriManager ********************************/
function nsYahooDomains()
{
    this.m_scriptLoader = null;
    this.m_Log = null;
    this.m_DomainManager = null;
    this.m_Timer = null;
    this.m_iCount = 0;
    this.m_iDomainsVersion = 1;
    this.m_aszDomain = ["yahoo.com"   , "yahoo.com.cn", "yahoo.com.au"  , "yahoo.com.hk",
                        "yahoo.com.sg", "yahoo.com.ar", "yahoo.com.ar"  , "yahoo.com.br",
                        "yahoo.es",    "yahoo.se"     , "yahoo.it"      , "yahoo.fr",
                        "yahoo.de",    "yahoo.ca"    , "yahoo.ie"       , "yahoo.co.jp",
                        "yahoo.co.uk", "yahoo.co.in" , "talk21.com"  , "btinternet.com",
                        "btopenworld.com"];
}


nsYahooDomains.prototype =
{
    classDescription : "Webmail Yahoo mail Domains",
    classID          : Components.ID("{10796650-dbc6-11da-a94d-0800200c9a66}"),
    contractID       : "@mozilla.org/YahooDomains;1",
    _xpcom_categories: [{category: "profile-after-change", service: true}],

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                            Components.interfaces.nsISupports,
                                            Components.interfaces.nsIYahooDomains]),


    loadStandardData : function()
    {
        try
        {
            this.m_Log.Write("nsYahooDomains.js - loadDataBase - START");

            //assume DB not ready start timer
            this.m_Timer = Components.classes["@mozilla.org/timer;1"]
                                    .createInstance(Components.interfaces.nsITimer);
            this.m_Timer.initWithCallback(this,
                                          250,
                                          Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);

            this.m_Log.Write("nsYahooDomains.js - loadDataBase - END");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsYahooDomains.js: loadDataBase : Exception : "
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
            this.m_Log.Write("nsYahooDomains.js : TimerCallback -  START");

            if(!this.m_DomainManager.isReady())
            {
                this.m_Log.Write("nsYahooDomains.js : TimerCallback -  db not ready");
                return;
            }

            if (this.m_iCount == 0)  //register content_id and extension guid
            {
                this.m_DomainManager.registerDomainHandler("@mozilla.org/YahooPOP;1", nsYahooExtGUID);
                this.m_DomainManager.registerDomainHandler("@mozilla.org/YahooSMTP;1",nsYahooExtGUID);
            }

            if (this.m_iCount< this.m_aszDomain.length)
            {
                if (!this.domainCheck( this.m_aszDomain[this.m_iCount], "POP", "@mozilla.org/YahooPOP;1"))
                    this.m_DomainManager.newDomain(this.m_aszDomain[this.m_iCount], "POP", "@mozilla.org/YahooPOP;1","true");
                if (!this.domainCheck(this.m_aszDomain[this.m_iCount], "SMTP", "@mozilla.org/YahooSMTP;1"))
                    this.m_DomainManager.newDomain(this.m_aszDomain[this.m_iCount], "SMTP", "@mozilla.org/YahooSMTP;1","true");
            }
            else
                timer.cancel();

            this.m_iCount++;

            this.m_Log.Write("nsYahooDomains.js : TimerCallback - END");
        }
        catch(e)
        {
            this.m_Timer.cancel();
            this.m_Log.DebugDump("nsYahooDomains.js : TimerCallback - Exception in notify : "
                                        + e.name +
                                        ".\nError message: "
                                        + e.message + "\n"
                                        + e.lineNumber);
        }
    },



    domainCheck : function (szDomain,szProtocol, szYahooContentID)
    {
        try
        {
            this.m_Log.Write("nsYahooDomains.js - domainCheck - START ");
            this.m_Log.Write("nsYahooDomains.js - domainCheck - " +szDomain + " " + szProtocol + " " + szYahooContentID);

            var bFound = false;
            var szContentID = new Object;
            var bDefault = new Object;
            if (this.m_DomainManager.newDomain(szDomain,szProtocol, szContentID, bDefault))
            {
                //check content id and defalut status
                if (szContentID.value == szYahooContentID && bDefault.value == true)
                    bFound = true;
            }

            this.m_Log.Write("nsYahooDomains.js - domainCheck - END " + bFound);
            return bFound;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsYahooDomains.js: domainCheck : Exception : "
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
                                          "YahooDomainsLog");
                try
                {
                    this.m_DomainManager = Components.classes["@mozilla.org/DomainManager;1"]
                                                     .getService()
                                                     .QueryInterface(Components.interfaces.nsIDomainManager);
                }
                catch(err)
                {
                    this.m_Log.Write("nsYahooDomains.js - domainmanager not found");
                }

                this.loadStandardData();
            break;


            case "em-action-requested":
                this.m_Log.Write("nsYahooDomains.js - em-action-requested ");
                aSubject.QueryInterface(Components.interfaces.nsIUpdateItem);

                if (aData == "item-uninstalled" && aSubject.id == nsYahooExtGUID)
                {
                    this.m_Log.Write("nsYahooDomains.js - Yahoo is being uninstalled ");
                    var prefAccess = new WebMailCommonPrefAccess();
                    prefAccess.DeleteBranch("yahoo.domains.version");
                }
            break;


            case "quit-application":
                this.m_Log.Write("nsYahooDomains.js - quit-application ");
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
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsYahooDomains]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsYahooDomains]);
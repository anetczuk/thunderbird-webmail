Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/***********************  UriManager ********************************/
function nsAOLDomains()
{
    this.m_scriptLoader = null;
    this.m_Log = null;
    this.m_DomainManager = null;
    this.m_Timer = null;
    this.m_bReady = false;
    this.m_iCount = 0;
    this.m_aszDomain = ["aol.com"   , "aim.com", "netscape.com"  , "netscape.net"];
}


nsAOLDomains.prototype =
{
    classDescription : "Webmail AOL  Domains",
    classID          : Components.ID("{0e1009c0-8533-11db-b606-0800200c9a66}"),
    contractID       : "@mozilla.org/AOLDomains;1",
    _xpcom_categories: [{category: "profile-after-change", service: true}],

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                            Components.interfaces.nsISupports,
                                            Components.interfaces.nsIDomains]),

    loadStandardData : function()
    {
        try
        {
            this.m_Log.Write("nsAOLDomains.js - loadDataBase - START");

            //assume DB not ready start timer
            this.m_Timer = Components.classes["@mozilla.org/timer;1"]
                                    .createInstance(Components.interfaces.nsITimer);
            this.m_Timer.initWithCallback(this,
                                          250,
                                          Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);

            this.m_Log.Write("nsAOLDomains.js - loadDataBase - END");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsAOLDomains.js: loadDataBase : Exception : "
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
            this.m_Log.Write("nsAOLDomains.js : TimerCallback -  START");


            if(!this.m_DomainManager.isReady())
            {
                this.m_Log.Write("nsYahooDomains.js : TimerCallback -  db not ready");
                return;
            }

            if (this.m_iCount == 0)  //register content_id and extension guid
            {
                this.m_DomainManager.registerDomainHandler("@mozilla.org/AOLPOP;1","{e977c180-9103-11da-a72b-0800200c9a66}");
                this.m_DomainManager.registerDomainHandler("@mozilla.org/AOLSMTP;1","{e977c180-9103-11da-a72b-0800200c9a66}");
            }

            if (this.m_iCount< this.m_aszDomain.length)
            {
                if (!this.domainCheck( this.m_aszDomain[this.m_iCount], "POP", "@mozilla.org/AOLPOP;1"))
                    this.m_DomainManager.newDomain(this.m_aszDomain[this.m_iCount], "POP", "@mozilla.org/AOLPOP;1","true");
                if (!this.domainCheck(this.m_aszDomain[this.m_iCount], "SMTP", "@mozilla.org/AOLSMTP;1"))
                    this.m_DomainManager.newDomain(this.m_aszDomain[this.m_iCount], "SMTP", "@mozilla.org/AOLSMTP;1","true");
            }
            else
                timer.cancel();

            this.m_iCount++;

            this.m_Log.Write("nsAOLDomains.js : TimerCallback - END");
        }
        catch(e)
        {
            this.m_Timer.cancel();
            this.m_Log.DebugDump("nsAOLDomains.js : TimerCallback - Exception in notify : "
                                        + e.name +
                                        ".\nError message: "
                                        + e.message + "\n"
                                        + e.lineNumber);
        }
    },




    domainCheck : function (szDomain,szProtocol, szAOLContentID)
    {
        try
        {
            this.m_Log.Write("nsAOLDomains.js - domainCheck - START ");
            this.m_Log.Write("nsAOLDomains.js - domainCheck - " +szDomain + " " + szProtocol + " " + szAOLContentID);

            var bFound = false;
            var szContentID = new Object;
            if (this.m_DomainManager.getDomainForProtocol(szDomain,szProtocol, szContentID))
            {

                if (szContentID.value == szAOLContentID)
                {
                    this.m_Log.Write("nsAOLDomains.js : idCheck - found");
                    bFound = true;
                }
            }

            this.m_Log.Write("nsAOLDomains.js - domainCheck - END " + bFound);
            return bFound;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsAOLDomains.js: domainCheck : Exception : "
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
                  var obsSvc = Components.classes["@mozilla.org/observer-service;1"].
                                            getService(Components.interfaces.nsIObserverService);
                 obsSvc.addObserver(this, "quit-application", false);

                this.m_scriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                                                  .getService(Components.interfaces.mozIJSSubScriptLoader);
                this.m_scriptLoader.loadSubScript("chrome://web-mail/content/common/DebugLog.js");
                this.m_scriptLoader.loadSubScript("chrome://web-mail/content/common/CommonPrefs.js");
                this.m_Log = new DebugLog("webmail.logging.comms",
                                          "{3c8e8390-2cf6-11d9-9669-0800200c9a66}",
                                          "AOLDomainsLog");
                try
                {
                    this.m_DomainManager = Components.classes["@mozilla.org/DomainManager;1"].
                                                        getService().
                                                        QueryInterface(Components.interfaces.nsIDomainManager);
                }
                catch(err)
                {
                    this.m_Log.Write("nsAOLDomains.js - domainmanager not found");
                }

                this.loadStandardData();
            break;

            case "quit-application":
                this.m_Log.Write("nsAOLDomains.js - quit-application ");
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
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsAOLDomains]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsAOLDomains]);
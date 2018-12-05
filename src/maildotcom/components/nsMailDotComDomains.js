Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const ExtMailDotComGuid = "{1ad5b3b0-b908-11d9-9669-0800200c9a66}";

/***********************  UriManager ********************************/
function nsMailDotComDomains()
{
    this.m_scriptLoader = null;
    this.m_Log = null;
    this.m_DomainManager = null;
    this.m_Timer = null;
    this.m_bReady = false;
    this.m_iCount = 0;
    this.m_aszDomain = ["email.com"        , "mail.com"      , "journalism.com"  , "iname.com",
                        "scientist.com"    , "earthling.net" , "techie.com"      , "usa.com",
                        "post.com"         , "witty.com"     , "whoever.com"     , "writeme.com",
                        "unforgettable.com", "teacher.com"   , "consultant.com"];
}




nsMailDotComDomains.prototype =
{
    classDescription : "Webmail MailDotCom  Domains",
    classID          : Components.ID("{b7aac840-03d2-11db-92e3-0800200c9a66}"),
    contractID       : "@mozilla.org/MailDotComDomains;1",
    _xpcom_categories: [{category: "profile-after-change", service: true}],

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                            Components.interfaces.nsISupports,
                                            Components.interfaces.nsIDomains]),


    isReady : function ()
    {
        this.m_Log.Write("nsMailDotComDomains.js - isReady - " +  this.m_bReady);
        return this.m_bReady;
    },

    addDomain : function (szDomain)
    {
        try
        {
            this.m_Log.Write("nsMailDotComDomains.js - addDomain - START " + szDomain);

            if ( szDomain.search(/[^a-zA-Z0-9\.\-]+/i)!=-1 ||
                 szDomain.search(/\s/)!=-1 ||
                 szDomain.search(/\./)==-1 ||
                 szDomain.search(/^\./)!=-1 ||
                 szDomain.search(/\.$/)!=-1)
            {
                this.m_Log.Write("nsMailDotComDomains.js - addDomain - domain invalid ");
                return false;
            }

            var bADD = false;

            if (!this.domainCheck(szDomain, "POP", "@mozilla.org/MailDotComPOP;1"))
                bADD = this.domainAdd(szDomain, "POP", "@mozilla.org/MailDotComPOP;1")

            if (!this.domainCheck(szDomain, "SMTP", "@mozilla.org/MailDotComSMTP;1"))
                bADD = this.domainAdd(szDomain, "SMTP", "@mozilla.org/MailDotComSMTP;1")


            this.m_Log.Write("nsMailDotComDomains.js - addDomain - END");
            return bADD;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsMailDotComDomains.js: addDomain : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber);

            return false;
        }
    },



    removeDomain : function (szDomain)
    {
        try
        {
            this.m_Log.Write("nsMailDotComDomains.js - removeDomain - START " + szDomain);

            var bFound = true;

            if ( szDomain.search(/[^a-zA-Z0-9\.]+/i)!=-1 ||
                 szDomain.search(/\s/)!=-1 ||
                 szDomain.search(/\./)==-1 ||
                 szDomain.search(/^\./)!=-1 ||
                 szDomain.search(/\.$/)!=-1)
            {
                this.m_Log.Write("nsMailDotComDomains.js - removeDomain - domain invalid ");
                return false;
            }

            this.m_DomainManager.removeDomainForProtocol(szDomain, "POP");
            this.m_DomainManager.removeDomainForProtocol(szDomain, "SMTP");


            this.m_Log.Write("nsMailDotComDomains.js - removeDomain - END");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsMailDotComDomains.js: removeDomain : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber);

            return false;
        }
    },




    getAllDomains : function(iCount, aszDomains)
    {
        try
        {
            this.m_Log.Write("nsMailDotComDomains.js - getAllDomains -  START " );

            this.m_DomainManager.getDomainForExtension("{304bef20-b908-11d9-9669-0800200c9a66}",iCount,aszDomains);
            this.m_Log.Write("nsMailDotComDomains.js - getAllDomains - " + iCount.value + " " + aszDomains.value);

            this.m_Log.Write("nsMailDotComDomains.js - getAllDomains -  END" );
            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsMailDotComDomains.js: getAllDomains : Exception : "
                                          + e.name +
                                          ".\nError message: "
                                          + e.message+ "\n"
                                          + e.lineNumber);

            return false;
        }
    },



    loadStandardData : function()
    {
        try
        {
            this.m_Log.Write("nsMailDotComDomains.js - loadDataBase - START");

            //assume DB not ready start timer
            this.m_Timer = Components.classes["@mozilla.org/timer;1"]
                                    .createInstance(Components.interfaces.nsITimer);
            this.m_Timer.initWithCallback(this,
                                          250,
                                          Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);


            this.m_Log.Write("nsMailDotComDomains.js - loadDataBase - END");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsMailDotComDomains.js: loadDataBase : Exception : "
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
            this.m_Log.Write("nsMailDotComDomains.js : TimerCallback -  START");

            if(!this.m_DomainManager.isReady())
            {
                this.m_Log.Write("nsMailDotComDomains.js : TimerCallback -  db not ready");
                return;
            }

            if (this.m_iCount == 0)  //register content_id and extension guid
            {
                this.m_DomainManager.registerDomainHandler("@mozilla.org/MailDotComPOP;1", "{1ad5b3b0-b908-11d9-9669-0800200c9a66}");
                this.m_DomainManager.registerDomainHandler("@mozilla.org/MailDotComSMTP;1", "{1ad5b3b0-b908-11d9-9669-0800200c9a66}");
            }

            if (this.m_iCount< this.m_aszDomain.length)
            {
                if (!this.domainCheck( this.m_aszDomain[this.m_iCount], "POP", "@mozilla.org/MailDotComPOP;1"))
                    this.m_DomainManager.newDomain(this.m_aszDomain[this.m_iCount], "POP", "@mozilla.org/MailDotComPOP;1","true");
                if (!this.domainCheck(this.m_aszDomain[this.m_iCount], "SMTP", "@mozilla.org/MailDotComSMTP;1"))
                    this.m_DomainManager.newDomain(this.m_aszDomain[this.m_iCount], "SMTP", "@mozilla.org/MailDotComSMTP;1","true");
            }
            else
            {
                timer.cancel();
                this.m_bReady = true;
            }
            this.m_iCount++;


            this.m_Log.Write("nsMailDotComDomains.js : TimerCallback - END");
        }
        catch(e)
        {
            timer.cancel();
            this.m_Log.DebugDump("nsMailDotComDomains.js : TimerCallback - Exception in notify : "
                                        + e.name +
                                        ".\nError message: "
                                        + e.message + "\n"
                                        + e.lineNumber);
        }
    },



    domainAdd : function (szDomain,szProtocol, szMailDotComContentID)
    {
        try
        {
            this.m_Log.Write("nsMailDotComDomains.js - domainAdd - START ");
            this.m_Log.Write("nsMailDotComDomains.js - domainAdd - " +szDomain + " " + szProtocol + " " + szMailDotComContentID);

            var bFound = this.m_DomainManager.newDomainForProtocol(szDomain, szProtocol, szMailDotComContentID);

            this.m_Log.Write("nsMailDotComDomains.js - domainAdd - END " + bFound);
            return bFound;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsMailDotComDomains.js: domainCheck : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber);

            return false;
        }
    },



    domainCheck : function (szDomain,szProtocol, szMailDotComContentID)
    {
        try
        {
            this.m_Log.Write("nsMailDotComDomains.js - domainCheck - START ");
            this.m_Log.Write("nsMailDotComDomains.js - domainCheck - " +szDomain + " " + szProtocol + " " + szMailDotComContentID);

            var bFound = false;
            var szContentID = new Object;
            if (this.m_DomainManager.getDomainForProtocol(szDomain,szProtocol, szContentID))
            {

                if (szContentID.value == szMailDotComContentID)
                {
                    this.m_Log.Write("nsMailDotComDomains.js : idCheck - found");
                    bFound = true;
                }
            }

            this.m_Log.Write("nsMailDotComDomains.js - domainCheck - END " + bFound);
            return bFound;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsMailDotComDomains.js: domainCheck : Exception : "
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
                                          "MailDotComDomainsLog");
                try
                {
                    this.m_DomainManager = Components.classes["@mozilla.org/DomainManager;1"].
                                                        getService().
                                                        QueryInterface(Components.interfaces.nsIDomainManager);
                }
                catch(err)
                {
                    this.m_Log.Write("nsMailDotComDomains.js - domainmanager not found");
                }

                this.loadStandardData();
            break;

            case "quit-application":
                this.m_Log.Write("nsMailDotComDomains.js - quit-application ");
            break;

            default:
                throw Components.Exception("Unknown topic: " + aTopic);

        }
    }
}




/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsMailDotComDomains]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsMailDotComDomains]);

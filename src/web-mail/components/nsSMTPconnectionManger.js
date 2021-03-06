Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/***********************  SMTPconnectionManager ********************************/

function nsSMTPConnectionManager()
{
    this.m_serverSocket = null;
    this.m_scriptLoader =  null;
    this.m_Log = null;
    this.m_iStatus = 0;  //-1 error , 0 = stopped ,1 = waiting, 2= ruuning
    this.m_aSMTPConnections = new Array();
    this.m_GarbageTimer = null;
    this.m_bGarbage = false;
    this.m_iSMTPPort = 0;
}

nsSMTPConnectionManager.prototype =
{
    classDescription : "Webmail SMTP Server",
    classID          : Components.ID("{961883d0-416d-11d9-9669-0800200c9a66}"),
    contractID       : "@mozilla.org/SMTPConnectionManager;1",
    _xpcom_categories: [{category: "profile-after-change", service: true}],

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                            Components.interfaces.nsISupports,
                                            Components.interfaces.nsISMTPConnectionManager]),

    Start : function()
    {
       try
       {
            this.m_Log.Write("nsSMTPConnectionManager.js - Start - START");

            if(this.m_iStatus != 2 && this.m_iStatus != 1)  //enter here if server is not running
            {
              //  if (!this.m_serverSocket)
               // {
                    this.m_serverSocket = Components.classes["@mozilla.org/network/server-socket;1"]
                                                    .createInstance(Components.interfaces.nsIServerSocket);
               // }

                //get pref settings
                var  WebMailPrefAccess = new WebMailCommonPrefAccess();
                var oPref = {Value:null};
                if (! WebMailPrefAccess.Get("int", "webmail.server.port.smtp", oPref))
                {
                    this.m_Log.Write("nsSMTPConnectionManager.js - Start - webmail.server.port.SMTP failed. Set to default 25");
                    oPref.Value = 25;
                }
                this.m_Log.Write("nsSMTPConnectionManager.js - Start - SMTP port value "+ oPref.Value);
                this.m_iSMTPPort = oPref.Value;
                WebMailPrefAccess = null;

                //create listener
                //connect only to this machine, 10 Queue
                this.m_serverSocket.init(this.m_iSMTPPort, true, 10);
                this.m_serverSocket.asyncListen(this);

                this.updateStatus(2);  //started
            }
            this.m_Log.Write("nsSMTPConnectionManager.js - Start - END");

            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsSMTPConnectionManager.js: Start : Exception : "
                                              + e.name
                                              + ".\nError message: "
                                              + e.message);

            this.updateStatus(-1);  //error
            return false;
        }
    },


    Stop : function()
    {
        try
        {
            this.m_Log.Write("nsSMTPConnectionManager.js - Stop - START");

            if (this.m_iStatus != 0 && this.m_iStatus != -1 && this.m_serverSocket) //only enter is not stopped
            {
                this.m_Log.Write("nsSMTPConnectionManager.js - Stop - stopping");
                this.m_serverSocket.close();  //stop new conections
                delete this.m_serverSocket;
                this.m_serverSocket = null;
                this.updateStatus(1);  //set status to waiting = 1
            }

            this.m_Log.Write("nsSMTPConnectionManager.js - Stop - END");
            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsSMTPConnectionManager.js: Stop : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message);
            this.updateStatus(-1);  //error

            return false;
        }
    },


    //-1 = ERROR (RED); 0 = Stopped (GREY); 1 = WAITING (AMBER)2 = Running (GREEN)
    GetStatus : function ()
    {
        try
        {
            this.m_Log.Write("nsSMTPConnectionManager.js - GetStatus = " + this.m_iStatus);
            return this.m_iStatus;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsSMTPConnectionManager.js: GetStatus : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message);
            this.updateStatus(-1);  //error
            return this.m_iStatus;
        }
    },



    GetPort : function ()
    {
        try
        {
            this.m_Log.Write("nsSMTPConnectionManager.js - GetPort = " + this.m_iSMTPPort);
            return this.m_iSMTPPort;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsSMTPConnectionManager.js: GetStatus : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message+ "\n"
                                          + e.lineNumber);
            return -1;
        }
    },



    onSocketAccepted : function(serverSocket, transport)
    {
        try
        {
            this.m_Log.Write("nsSMTPConnectionManager.js - onSocketAccepted - START");

            this.m_aSMTPConnections.push ( new SMTPconnectionHandler(transport));

            this.m_Log.Write("nsSMTPConnectionManager.js - onSocketAccepted - END");
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsSMTPConnectionManager.js: onSocketAccepted : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message);
        }
    },


    onStopListening : function(serverSocket, status)
    {
       this.m_Log.Write("nsSMTPConnectionManager.js - onStopListening - START");
       this.updateStatus(0);
       this.m_Log.Write("nsSMTPConnectionManager.js - onStopListening - END");
    },


    //garbage collection
    notify : function()
    {
        try
        {
           // this.m_Log.Write("nsSMTPConnectionManager.js - notify - START");  //spamming log file

          //  this.m_Log.Write("nsSMTPConnectionManager.js - notify - connections " +this.m_aSMTPConnections.length);
            if (this.m_aSMTPConnections.length>0)
            {
                var iMax = this.m_aSMTPConnections.length;
                var i = 0;
                for (i = 0 ; i<iMax ; i++)
                {
                    this.m_Log.Write("nsSMTPConnectionManager.js - connection " + 0 + " "+ this.m_aSMTPConnections[0]);

                    if (this.m_aSMTPConnections[0] != undefined)
                    {
                        var temp = this.m_aSMTPConnections.shift();  //get first item
                        this.m_Log.Write("nsSMTPConnectionManager.js - connection " + i + " "+ temp.bRunning + " " +temp.iID)

                        if (temp.bRunning == false)
                        {
                            temp = null;
                            this.m_Log.Write("nsSMTPConnectionManager.js - notify - dead connection deleted" + " " +temp.iID);
                        }
                        else
                        {
                            this.m_aSMTPConnections.push(temp);
                            this.m_Log.Write("nsSMTPConnectionManager.js - notify - restored live connection"+ " " +temp.iID);
                        }
                    }
                }
            }

           // this.m_Log.Write("nsSMTPConnectionManager.js - notify - END");
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsSMTPConnectionManager.js: notify : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message);
        }
    },


    updateStatus : function(iStatus)
    {
       this.m_Log.Write("nsSMTPConnectionManager - updateStatus - START " + iStatus);
       this.m_iStatus = iStatus;

       Components.classes["@mozilla.org/observer-service;1"]
                 .getService(Components.interfaces.nsIObserverService)
                 .notifyObservers(null, "webmail-smtp-status-change", this.m_iStatus.toString());

       this.m_Log.Write("nsSMTPConnectionManager - updateStatus - END");
    },



    observe : function(aSubject, aTopic, aData)
    {
        switch(aTopic)
        {
            case "xpcom-startup":
                // this is run very early, right after XPCOM is initialized, but before
                // user profile information is applied.



            break;

            case "profile-after-change":
                // This happens after profile has been loaded and user preferences have been read.
                // startup code here
                var obsSvc = Components.classes["@mozilla.org/observer-service;1"].
                                        getService(Components.interfaces.nsIObserverService);
                obsSvc.addObserver(this, "profile-after-change", false);
                obsSvc.addObserver(this, "quit-application", false);

                this.m_scriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                                                .getService(Components.interfaces.mozIJSSubScriptLoader);

                this.m_GarbageTimer = Components.classes["@mozilla.org/timer;1"]
                                                .createInstance(Components.interfaces.nsITimer);

                this.m_GarbageTimer.initWithCallback(this,
                                                     20000, //20 seconds
                                                     Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
                this.m_bGarbage = true;

                this.m_serverSocket = Components.classes["@mozilla.org/network/server-socket;1"]
                                                .createInstance(Components.interfaces.nsIServerSocket);
                this.m_scriptLoader .loadSubScript("chrome://web-mail/content/common/DebugLog.js");
                this.m_scriptLoader .loadSubScript("chrome://web-mail/content/common/CommonPrefs.js");
                this.m_scriptLoader .loadSubScript("chrome://web-mail/content/server/smtpConnectionHandler.js");
                this.m_Log = new DebugLog("webmail.logging.comms",
                                          "{3c8e8390-2cf6-11d9-9669-0800200c9a66}",
                                          "SMTPServerlog");

                var obsSvc = Components.classes["@mozilla.org/observer-service;1"]
                                       .getService(Components.interfaces.nsIObserverService);
                obsSvc.addObserver(this, "network:offline-status-changed", false);

                var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                          .getService(Components.interfaces.nsIIOService);
                var bOffline = ioService.offline;
                this.m_Log.Write("nsSMTPConnectionManager :profile-after-change - offline " + bOffline);

                var  WebMailPrefAccess = new WebMailCommonPrefAccess();
                var oPref = {Value:null};
                if (! WebMailPrefAccess.Get("int", "webmail.server.port.smtp", oPref))
                {
                    this.m_Log.Write("nsSMTPConnectionManager.js : profile-after-change  - Set to default 25");
                    oPref.Value = 25;
                }
                this.m_Log.Write("nsSMTPConnectionManager.js : profile-after-change - SMTP port value "+ oPref.Value);
                this.m_iSMTPPort = oPref.Value;

                var bStart = false;
                oPref.Value = null;
                WebMailPrefAccess.Get("bool","webmail.bUseSMTPServer",oPref);
                if (oPref.Value) bStart = true;
                this.m_Log.Write("nsSMTPConnectionManager : profile-after-change - bStart " + bStart);
                WebMailPrefAccess = null;

                if (!bOffline && bStart) this.Start();
            break;

            case "quit-application": // shutdown code here
                this.Stop();
            break;


            case "network:offline-status-changed":
                this.m_Log.Write("nsSMTPConnectionManager : network:offline-status-changed " + aData);

                var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                          .getService(Components.interfaces.nsIIOService);
                var bOffline = ioService.offline;
                this.m_Log.Write("nsSMTPConnectionManager : bOffline " + bOffline );

                if (aData.search(/online/)!=-1)
                {
                    this.m_Log.Write("nsSMTPConnectionManager : going  Online");
                    var oPref = new Object();
                    oPref.Value = null;
                    var  WebMailPrefAccess = new WebMailCommonPrefAccess();
                    WebMailPrefAccess.Get("bool","webmail.bUseSMTPServer",oPref);
                    if (oPref.Value)
                    {
                        this.m_Log.Write("nsSMTPConnectionManager : SMTP server wanted");
                        if (this.Start())
                            this.m_Log.Write("nsSMTPConnectionManager : SMTP server started");
                    }
                }
                else if (aData.search(/offline/)!=-1 && bOffline)
                {
                    this.m_Log.Write("nsSMTPConnectionManager : going Offline");
                    this.Stop();
                }
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
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsSMTPConnectionManager]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsSMTPConnectionManager]);
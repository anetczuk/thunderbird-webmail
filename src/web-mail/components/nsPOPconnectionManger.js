Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const szOK ="+OK thats cool\r\n";
const szERR ="-ERR negative vibes\r\n";
/***********************  POPconnectionManager ********************************/
function nsPOPConnectionManager()
{
    this.m_serverSocket = null;
    this.m_scriptLoader = null;
    this.m_GarbageTimer= null;
    this.m_Log = null;
    this.m_iStatus = 0;   //-1 error , 0 = stopped ,1 = waiting, 2= ruuning
    this.m_aPOPConnections = new Array();
    this.m_iPopPort = 0;
}

nsPOPConnectionManager.prototype =
{
    classDescription : "Webmail Pop Server",
    classID          : Components.ID("{0d1b2fb0-4168-11d9-9669-0800200c9a66}"),
    contractID       : "@mozilla.org/POPConnectionManager;1",
    _xpcom_categories: [{category: "profile-after-change", service: true}],

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                            Components.interfaces.nsISupports,
                                            Components.interfaces.nsIPOPConnectionManager]),

    Start : function()
    {
       try
       {
            this.m_Log.Write("nsPOPConnectionManager - Start - START");

            this.m_Log.Write("nsPOPConnectionManager - Start - this.m_iStatus " + this.m_iStatus);
            if(this.m_iStatus != 2 && this.m_iStatus != 1)  //enter here if server is not running
            {
              //  if (!this.m_serverSocket)
              //  {
                    this.m_Log.Write("nsPOPConnectionManager - Start - creating server");
                    this.m_serverSocket = Components.classes["@mozilla.org/network/server-socket;1"]
                                                    .createInstance(Components.interfaces.nsIServerSocket);
              //  }

                //get pref settings
                var  WebMailPrefAccess = new WebMailCommonPrefAccess();
                var oPref = {Value:null};
                if (! WebMailPrefAccess.Get("int", "webmail.server.port.pop", oPref))
                {
                    this.m_Log.Write("nsPOPConnectionManager - Start - webmail.server.port.pop failed. Set to default 110");
                    oPref.Value = 110;
                }
                this.m_Log.Write("nsPOPConnectionManager - Start - POP port value "+ oPref.Value);
                this.m_iPopPort = oPref.Value;
                WebMailPrefAccess = null;

                //create listener
                //connect only to this machine, 10 Queue
                this.m_serverSocket.init(this.m_iPopPort, true, 10);
                this.m_serverSocket.asyncListen(this);

                this.updateStatus(2);  //started
            }
            this.m_Log.Write("nsPOPConnectionManager - Start - END");

            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsPOPConnectionManager: Start : Exception : "
                                              + e.name
                                              + ".\nError message: "
                                              + e.message +"\n"
                                              + e.lineNumber);

            this.updateStatus(-1);  //error
            return false;
        }
    },


    Stop : function()
    {
        try
        {
            this.m_Log.Write("nsPOPConnectionManager - Stop - START");

            this.m_Log.Write("nsPOPConnectionManager - Start - this.m_iStatus " + this.m_iStatus);
            if (this.m_iStatus != 0 && this.m_iStatus != -1 && this.m_serverSocket) //only enter if server has not stopped
            {
                this.m_Log.Write("nsPOPConnectionManager - Stop - stopping");
                this.m_serverSocket.close();  //stop new conections
                delete this.m_serverSocket;
                this.m_serverSocket = null;
                this.updateStatus(1);  //set status to waiting = 1
            }

            this.m_Log.Write("nsPOPConnectionManager - Stop - END");
            return true;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsPOPConnectionManager: Stop : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message+"\n"
                                          + e.lineNumber);
            this.updateStatus(-1);  //error

            return false;
        }
    },


    //-1 = ERROR (RED); 0 = Stopped (GREY); 1 = WAITING (AMBER)2 = Running (GREEN)
    GetStatus : function ()
    {
        try
        {
            this.m_Log.Write("nsPOPConnectionManager - GetStatus = " + this.m_iStatus);
            return this.m_iStatus;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsPOPConnectionManager: GetStatus : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message +"\n"
                                          + e.lineNumber);

            this.updateStatus(-1);  //error
            return this.m_iStatus;
        }
    },



    GetPort : function ()
    {
        try
        {
            this.m_Log.Write("nsPOPConnectionManager.js - GetPort = " + this.m_iPopPort);
            return this.m_iPopPort;
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsPOPConnectionManager.js: GetStatus : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message+ "\n"
                                          + e.lineNumber);
        }
    },



    onSocketAccepted : function(serverSocket, transport)
    {
        try
        {
            this.m_Log.Write("nsPOPConnectionManager - onSocketAccepted - START");

            this.m_aPOPConnections.push ( new POPconnectionHandler(transport));

            this.m_Log.Write("nsPOPConnectionManager - onSocketAccepted - END");
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsPOPConnectionManager: onSocketAccepted : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message+"\n"
                                          + e.lineNumber);
        }
    },




    onStopListening : function(serverSocket, status)
    {
       this.m_Log.Write("nsPOPConnectionManager - onStopListening - START " + status);
       this.updateStatus(0);
       this.m_Log.Write("nsPOPConnectionManager - onStopListening - END");
    },



    updateStatus : function(iStatus)
    {
       this.m_Log.Write("nsPOPConnectionManager - updateStatus - START " + iStatus);
       this.m_iStatus = iStatus;

       Components.classes["@mozilla.org/observer-service;1"]
                 .getService(Components.interfaces.nsIObserverService)
                 .notifyObservers(null, "webmail-pop-status-change", this.m_iStatus.toString());

       this.m_Log.Write("nsPOPConnectionManager - updateStatus - END");
    },



    //garbage collection
    notify : function()
    {
        try
        {
           // this.m_Log.Write("nsPOPConnectionManager - notify - START");  //spamming log file

          //  this.m_Log.Write("nsPOPConnectionManager - notify - connections " +this.m_aPOPConnections.length);
            if (this.m_aPOPConnections.length>0)
            {
                var iMax = this.m_aPOPConnections.length;
                var i = 0;
                for (i = 0 ; i<iMax ; i++)
                {
                    this.m_Log.Write("nsPOPConnectionManager - connection " + 0 + " "+ this.m_aPOPConnections[0]);

                    if (this.m_aPOPConnections[0] != undefined)
                    {
                        var temp = this.m_aPOPConnections.shift();  //get first item
                        this.m_Log.Write("nsPOPConnectionManager - connection " + i + " "+ temp.bRunning + " " +temp.iID);

                        if (temp.bRunning == false)
                        {
                            temp = null;
                            this.m_Log.Write("nsPOPConnectionManager - notify - dead connection deleted " + temp.iID);
                        }
                        else
                        {
                            this.m_aPOPConnections.push(temp);
                            this.m_Log.Write("nsPOPConnectionManager - notify - restored live connection " + temp.iID);
                        }
                    }
                }
            }

           // this.m_Log.Write("nsPOPConnectionManager - notify - END");
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsPOPConnectionManager: notify : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message +"\n"
                                          + e.lineNumber);
        }
    },


    observe : function(aSubject, aTopic, aData)
    {
        switch(aTopic)
        {
            case "profile-after-change":
                this.m_scriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                                                 .getService(Components.interfaces.mozIJSSubScriptLoader);
                this.m_scriptLoader.loadSubScript("chrome://web-mail/content/common/DebugLog.js");
                this.m_scriptLoader.loadSubScript("chrome://web-mail/content/common/CommonPrefs.js");
                this.m_scriptLoader.loadSubScript("chrome://web-mail/content/server/popConnectionHandler.js");
                this.m_Log = new DebugLog("webmail.logging.comms",
                        "{3c8e8390-2cf6-11d9-9669-0800200c9a66}",
                        "popServerlog");

                this.m_Log.Write("nsDomainManager.js - profile-after-change ");

                var obsSvc = Components.classes["@mozilla.org/observer-service;1"]
                                .getService(Components.interfaces.nsIObserverService);
                obsSvc.addObserver(this, "network:offline-status-changed", false);
                obsSvc.addObserver(this, "quit-application", false);

                var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                          .getService(Components.interfaces.nsIIOService);
                var bOffline = ioService.offline;
                this.m_Log.Write("nsPOPConnectionManager :profile-after-change - offline " + bOffline);

                var  WebMailPrefAccess = new WebMailCommonPrefAccess();
                var oPref = {Value:null};
                if (! WebMailPrefAccess.Get("int", "webmail.server.port.pop", oPref))
                {
                this.m_Log.Write("nsPOPConnectionManager : profile-after-change - Set to default 110");
                oPref.Value = 110;
                }
                this.m_Log.Write("nsPOPConnectionManager : profile-after-change  - POP port value "+ oPref.Value);
                this.m_iPopPort = oPref.Value;

                var bStart = false;
                oPref.Value = null;
                WebMailPrefAccess.Get("bool","webmail.bUsePOPServer",oPref);
                if (oPref.Value) bStart = true;
                this.m_Log.Write("nsPOPConnectionManager : profile-after-change - bStart " + bStart);
                WebMailPrefAccess = null;

                if (!bOffline && bStart) this.Start();
            break;

            case "quit-application": // shutdown code here
                this.m_Log.Write("nsPOPConnectionManager : quit-application");
                this.Stop();
            break;

            case "network:offline-status-changed":
                this.m_Log.Write("nsPOPConnectionManager : network:offline-status-changed " + aData );

                var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                          .getService(Components.interfaces.nsIIOService);
                var bOffline = ioService.offline;
                this.m_Log.Write("nsPOPConnectionManager : bOffline " + bOffline );

                if (aData.search(/online/)!=-1)
                {
                    this.m_Log.Write("nsPOPConnectionManager : going  Online");
                    var  WebMailPrefAccess = new WebMailCommonPrefAccess();
                    var oPref = new Object();
                    oPref.Value = null;
                    WebMailPrefAccess.Get("bool","webmail.bUsePOPServer",oPref);
                    if (oPref.Value)
                    {
                        this.m_Log.Write("nsPOPConnectionManager :  POP server wanted");
                        if (this.Start())
                            this.m_Log.Write("nsPOPConnectionManager : pop server started");
                    }
                }
                else if (aData.search(/offline/)!=-1 && bOffline)
                {
                    this.m_Log.Write("nsPOPConnectionManager : going Offline");
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
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsPOPConnectionManager]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsPOPConnectionManager]);
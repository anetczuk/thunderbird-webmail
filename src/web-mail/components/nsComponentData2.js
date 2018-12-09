Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/***********************  Component Data ********************************/
function nsComponentData2()
{
    this.m_Log = null;
    this.m_dbService = null;
    this.m_dbConn = null;
    this.m_bIsReady = false;
    this.m_scriptLoader = null;
}




nsComponentData2.prototype =
{
    classDescription : "Webmail Componet Data",
    classID          : Components.ID("{57364ea6-f75f-11db-8314-0800200c9a66}"),
    contractID       : "@mozilla.org/ComponentData2;1",
    _xpcom_categories: [{category: "profile-after-change", service: true}],

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                            Components.interfaces.nsISupports,
                                            Components.interfaces.nsIComponentData2]),


    addElement : function (szUserName, szName, szValue)
    {
        try
        {
            this.m_Log.Write("nsComponentData.js - addElement - START");
            this.m_Log.Write("nsComponentData.js - addElement - " + szUserName + " - "+ szName +" - " + szValue);

            var szSQL =null;
            szSQL = "REPLACE INTO webmail_components (id, user_name, component_name, component_value) " +
                    "VALUES " +
                    "(" +
                    "   (" +
                    "       SELECT id FROM webmail_components  " +
                    "       WHERE user_name LIKE ?1 AND component_name LIKE ?2 " +
                    "   ), " +
                    "   ?1, " +
                    "   ?2, " +
                    "   ?3 " +
                    "); "

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.bindStringParameter(0, szUserName.toLowerCase()); //username
            statement.bindStringParameter(1, szName);                   //component name
            statement.bindStringParameter(2, szValue);                  //component value
            statement.execute();

            this.m_Log.Write("nsComponentData.js - addElement - END");
            return true;
        }
        catch(err)
        {
             this.m_Log.DebugDump("nsComponentData.js: addElement : Exception : "
                                      + err.name +
                                      ".\nError message: "
                                      + err.message+ "\n"
                                      + err.lineNumber+ "\n"
                                      + this.m_dbConn.lastErrorString);
             return false;
        }
    },



    findElement : function (szUserName, szName)
    {
        try
        {
            this.m_Log.Write("nsComponentData.js - findElement - START");
            this.m_Log.Write("nsComponentData.js - findElement - "  + szUserName + " " + szName);

            var szValue = null;
            var szSQL = null;
            szSQL = "SELECT *  " +
                    "FROM webmail_components " +
                    "WHERE user_name LIKE ?1 AND component_name LIKE ?2";

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.bindStringParameter(0, szUserName.toLowerCase()); //username
            statement.bindStringParameter(1, szName);                   //component name

            try
            {
                while (statement.executeStep())
                {
                    szValue = statement.row["component_value"];
                    this.m_Log.Write("nsComponentData.js - findElement - data - found " + szValue);
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsComponentData : findCookie - DB Reset "+ this.m_dbConn.lastErrorString);
            }

            this.m_Log.Write(".js - findElement - END");
            return szValue;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsComponentData.js: findElement : Exception : "
                                      + err.name +
                                      ".\nError message: "
                                      + err.message+ "\n"
                                      + err.lineNumber+ "\n"
                                      + this.m_dbConn.lastErrorString);
            return null;
        }
    },



    deleteElement: function (szUserName, szName)
    {
        try
        {
            this.m_Log.Write("nsComponentData.js - deleteElement - START");
            this.m_Log.Write("nsComponentData.js - deleteElement - " + szUserName + " " + szName);

            var szSQL = "DELETE FROM webmail_components " +
                        "WHERE user_name LIKE ?1 AND component_name LIKE ?2";
            var statement = this.m_dbConn.createStatement(szSQL);
            statement.bindStringParameter(0, szUserName.toLowerCase());
            statement.bindStringParameter(1, szName);
            statement.execute();

            this.m_Log.Write("nsComponentData.js - deleteElement - END");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsComponentData.js: deleteElement : Exception : "
                                      + err.name +
                                      ".\nError message: "
                                      + err.message+ "\n"
                                      + err.lineNumber+ "\n"
                                      + this.m_dbConn.lastErrorString);
            return false;
        }
    },



    deleteAllElements : function (szUserName)
    {
        try
        {
            this.m_Log.Write("nsComponentData.js - deleteElement - START " + szUserName);

            var szSQL = "DELETE FROM webmail_components " +
                        "WHERE user_name LIKE ?1";
            var statement = this.m_dbConn.createStatement(szSQL);
            statement.bindStringParameter(0, szUserName.toLowerCase());
            statement.execute();

            this.m_Log.Write("nsComponentData.js - deleteElement - END");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsComponentData.js: deleteAllElements : Exception : "
                                      + err.name +
                                      ".\nError message: "
                                      + err.message+ "\n"
                                      + err.lineNumber+ "\n"
                                      + this.m_dbConn.lastErrorString);
            return false;
        }
    },





     //private functions

    loadDataBase : function()
    {
        try
        {
            this.m_Log.Write("ComponentManager.js - loadDataBase - START");

            try
            {
                this.m_dbService = Components.classes["@mozilla.org/storage/service;1"]
                                             .getService(Components.interfaces.mozIStorageService);
            }
            catch(err)
            {
                this.m_Log.Write("ComponentManager.js : startUp - SQL components NOT installed");
                throw new Error("no database");
            }

            //load DB
            /*
            var fileDB = Components.classes["@mozilla.org/file/directory_service;1"];
            fileDB = fileDB.createInstance(Components.interfaces.nsIProperties);
            fileDB = fileDB.get("ProfD", Components.interfaces.nsIFile);
            fileDB.append("WebmailData");         //add folder
            if (!fileDB.exists())    //check folder exist
                fileDB.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0664);
            fileDB.append("components.db3");         //sqlite database
            fileDB.QueryInterface(Components.interfaces.nsIFile)
            this.m_Log.Write("CookieManager.js - loadDB - fileDB "+ fileDB.path);
            this.m_dbConn = this.m_dbService.openDatabase(fileDB);
            */
            this.m_dbConn = this.m_dbService.openSpecialDatabase("memory");
            if (!this.m_dbConn) return false;

            this.createDB();

            this.m_bIsReady = true;

            this.m_Log.Write("ComponentManager.js - loadDataBase - END");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("ComponentManager.js: loadDataBase : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber+ "\n"
                                          + this.m_dbConn.lastErrorString);

            return false;
        }
    },



    createDB : function ()
    {
        try
        {
            this.m_Log.Write("ComponentManager.js - createDB - START");
            var szSQL;

            //account table
            szSQL = "CREATE TABLE webmail_components " +
                    "(" +
                       "id INTEGER PRIMARY KEY AUTOINCREMENT, "+
                        "user_name TEXT, " +
                        "component_name TEXT," +
                        "component_value TEXT" +
                    ");";
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("ComponentManager.js - createDB - szSQL " + szSQL);

            this.m_Log.Write("ComponentManager.js - createDB - END");

        }
        catch(err)
        {
            this.m_Log.DebugDump("ComponentManager.js: createDB : Exception : "
                                          + err.name +
                                          "\nError message: "
                                          + err.message +"\n"
                                          + "DB Error " + "\n"
                                          + err.lineNumber+ "\n"
                                          + this.m_dbConn.lastErrorString);
            return false;
        }
    },


/******************************************************************************/
/***************** XPCOM  stuff ***********************************************/
/******************************************************************************/
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
                this.m_Log = new DebugLog("webmail.logging.comms",
                                          "{3c8e8390-2cf6-11d9-9669-0800200c9a66}",
                                          "Component Manager");

                this.m_Log.Write("nsComponentData.js - profile-after-change");
                this.loadDataBase();
            break;

            case "quit-application":
                this.m_Log.Write("nsComponentData.js - quit-application ");
            break;

            default: throw Components.Exception("Unknown topic: " + aTopic);
        }
    }
};

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsComponentData2]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsComponentData2]);
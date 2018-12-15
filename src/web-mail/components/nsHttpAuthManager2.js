Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");


/***********************  HttpAuthManager ********************************/
function nsHttpAuthManager2()
{
    this.m_Log = null;
    this.m_dbService = null;
    this.m_dbConn = null;
    this.m_bIsReady = false;
    this.m_scriptLoader = null;
}



nsHttpAuthManager2.prototype =
{
    classDescription : "Webmail Http Auth Manager 2",
    classID          : Components.ID("{2eca88f8-f75b-11db-8314-0800200c9a66}"),
    contractID       : "@mozilla.org/HttpAuthManager2;1",
    _xpcom_categories: [{category: "profile-after-change", service: true}],

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                            Components.interfaces.nsISupports,
                                            Components.interfaces.nsIHttpAuthManager2]),




    addToken : function (szDomain , szHeader, szURI ,szUserName, szPassword)
    {
        try
        {
            this.m_Log.Write("nsHttpAuthManager - addToken - START");
            this.m_Log.Write("nsHttpAuthManager - addToken - \ndomain "
                                                        + szDomain +"\n"
                                                        + "Header " + szHeader
                                                        + "URI " + szURI
                                                        + "username " + szUserName
                                                        + "password " + szPassword);

            if (!szDomain || !szHeader || !szUserName || !szPassword) return false;

            var szSQL =null;
            szSQL = "REPLACE INTO webmail_auth (id, user_name, auth_domain, auth_token) " +
                    "VALUES" +
                    "(" +
                    "   (" +
                    "       SELECT id FROM webmail_auth  " +
                    "       WHERE user_name LIKE ?1 AND auth_domain LIKE ?2 " +
                    "   ), " +
                    "   ?1," +
                    "   ?2," +
                    "   ?3 " +
                    ");"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.bindStringParameter(0, szUserName.toLowerCase()); //username
            var tempDomain = szDomain.replace(/^\./,"%.");
            statement.bindStringParameter(1, tempDomain);               //Auth domain
            var tempToken = this.newToken(szHeader, szURI, szUserName, szPassword)
            statement.bindStringParameter(2, tempToken);                //Auth Token
            statement.execute();

            this.m_Log.Write("nsHttpAuthManager - addToken - END");
            return true;
        }
        catch(e)
        {
             this.m_Log.Write("nsHttpAuthManager: addToken : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message+ "\n"
                                          + e.lineNumber+ "\n"
                                          + this.m_dbConn.lastErrorString);
        }
    },



    findToken :  function (szUserName, szDomain)
    {
        try
        {
            this.m_Log.Write("nsHttpAuthManager - findToken - START " +szUserName);
            this.m_Log.Write("nsHttpAuthManager - findToken - target domain - " + szDomain);
            if (!szDomain && !szUserName) return null;

            var szAuth = null;
            var szSQL = null;
            szSQL = "SELECT *  " +
                    "FROM webmail_auth " +
                    "WHERE user_name LIKE ?1 AND ?2 LIKE auth_domain";

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.bindStringParameter(0, szUserName.toLowerCase()); //username
            statement.bindStringParameter(1, szDomain);                 //cookie domain

            try
            {
                while (statement.executeStep())
                {
                    var szToken = statement.row["auth_token"];
                    this.m_Log.Write("nsHttpAuthManager.js - findToken - found " + szToken);
                    szAuth =  szToken;
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsHttpAuthManager2 : findCookie - DB Reset "+ this.m_dbConn.lastErrorString);
            }

            this.m_Log.Write("nsHttpAuthManager - findToken - END");
            return szAuth;
        }
        catch(e)
        {
            this.m_Log.Write("nsHttpAuthManager: findToken : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message+ "\n"
                                          + e.lineNumber+ "\n"
                                          + this.m_dbConn.lastErrorString);

            return null;
        }
    },


    removeToken : function (szUserName)
    {
        try
        {
            this.m_Log.Write("nsHttpAuthManager.js - removeCookie - START " + szUserName);

            var szSQL = "DELETE FROM webmail_auth WHERE user_name LIKE ?1";
            var statement = this.m_dbConn.createStatement(szSQL);
            statement.bindStringParameter(0, szUserName.toLowerCase());
            statement.execute();
            this.m_Log.Write("nsHttpAuthManager.js - removeCookie - END");
            return true;
        }
        catch(e)
        {
             this.m_Log.Write("nsHttpAuthManager.js: removeCookie : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message + " \n"
                                          + e.lineNumber+ "\n"
                                          + this.m_dbConn.lastErrorString);
            return false;
        }
    },


    //private functions

    randomString : function ()
    {
        var seed = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
        var iLength = 10;
        var szRandom = "";
        for (var i=0; i<iLength; i++)
        {
            var rnum = Math.floor(Math.random() * seed.length);
            szRandom += seed.substring(rnum,rnum+1);
        }
        return szRandom;
    },



    newToken : function (szValue, szURI ,szUserName, szPassword)
    {
        try
        {
            this.m_Log.Write("nsHttpAuthManager.js - newToken - START");

            var szAuth = null;
            if (szValue.search(/basic/i)!= -1)
            {//authentication on the cheap
                this.m_Log.Write("nsHttpAuthManager.js - newToken - basic Authenticate");

                var oBase64 = new base64();
                szAuth ="Basic ";
                szAuth += oBase64.encode(szUserName+":"+szPassword);
            }
            else
            {
                this.m_Log.Write("nsHttpAuthManager.js - newToken - digest Authenticate");

                szAuth ="Digest ";
                szAuth +="username=\"" + szUserName + "\", ";
                var szRealm = szValue.match(/realm="(.*?)"/i)[1];
                szAuth +="realm=\"" + szRealm + "\", ";
                var szNC = "00000001";
                szAuth +="nc=" + szNC + ", ";
                szAuth +="algorithm=\"MD5\", ";

                var tempURI = null;
                try
                {
                    tempURI = szURI.match(/(.*?)\?/i)[1];
                }
                catch(e)
                {
                    tempURI = szURI;
                }

                szAuth +="uri=\"" + tempURI + "\", ";
                var szConce = this.randomString();
                szAuth +="cnonce=\"" + szConce + "\", ";

                //find qop and noncem
                var szQop = szValue.match(/qop="(.*?)"/i)[1];
                this.m_Log.Write("nsHttpAuthManager.js - newToken - Qop: " + szQop);
                szAuth +="qop=\"" + szQop + "\", ";

                var szNonce = szValue.match(/nonce="(.*?)"/i)[1];
                this.m_Log.Write("nsHttpAuthManager.js - newToken - Nonce : " + szNonce);
                szAuth +="nonce=\"" + szNonce + "\", ";

                //hash
                var oHash = new hash();

                var szHA1=oHash.md5Hash(szUserName+":"+szRealm+":"+szPassword);
                this.m_Log.Write("nsHttpAuthManager.js - newToken - HA1 " + szHA1);

                var szHA2 = oHash.md5Hash("PROPFIND:"+tempURI);
                this.m_Log.Write("nsHttpAuthManager.js - newToken - HA2 " + szHA2);

                var szResponse = oHash.md5Hash(szHA1+":"+szNonce+":"+szNC+":"+szConce+":"+szQop+":"+szHA2);

                this.m_Log.Write("nsHttpAuthManager.js - newToken - response " + szResponse);
                szAuth +="response=\"" + szResponse + "\"";
            }

            this.m_Log.Write("nsHttpAuthManager.js - newToken - " +  szAuth);
            this.m_Log.Write("nsHttpAuthManager.js - newToken - END");
            return szAuth;
        }
        catch(e)
        {
            this.m_Log.Write("nsHttpAuthManager.js: newToken : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message+ "\n"
                                          + e.lineNumber);
        }
    },





    loadDataBase : function()
    {
        try
        {
            this.m_Log.Write("nsHttpAuthManager.js - loadDataBase - START");

            try
            {
                this.m_dbService = Components.classes["@mozilla.org/storage/service;1"]
                                             .getService(Components.interfaces.mozIStorageService);
            }
            catch(err)
            {
                this.m_Log.Write("nsHttpAuthManager.js : startUp - SQL components NOT installed");
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
            fileDB.append("auth.db3");         //sqlite database
            fileDB.QueryInterface(Components.interfaces.nsIFile)
            this.m_Log.Write("CookieManager.js - loadDB - fileDB "+ fileDB.path);
            this.m_dbConn = this.m_dbService.openDatabase(fileDB);
            */
            this.m_dbConn = this.m_dbService.openSpecialDatabase("memory");
            if (!this.m_dbConn) return false;

            this.createDB();

            this.m_bIsReady = true;

            this.m_Log.Write("nsHttpAuthManager.js - loadDataBase - END");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsHttpAuthManager.js: loadDataBase : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber);

            return false;
        }
    },



    createDB : function ()
    {
        try
        {
            this.m_Log.Write("nsHttpAuthManager.js - createDB - START");
            var szSQL;

            //account table
            szSQL = "CREATE TABLE webmail_auth " +
                    "(" +
                       "id INTEGER PRIMARY KEY AUTOINCREMENT, "+
                        "user_name TEXT, " +
                        "auth_domain TEXT," +
                        "auth_token TEXT " +
                    ");";
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("nsHttpAuthManager.js - createDB - szSQL " + szSQL);

            this.m_Log.Write("nsHttpAuthManager.js - createDB - END");

        }
        catch(err)
        {
            this.m_Log.DebugDump("nsHttpAuthManager.js: createDB : Exception : "
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
                this.m_scriptLoader.loadSubScript("chrome://web-mail/content/common/HttpAuthToken.js");
                this.m_scriptLoader.loadSubScript("chrome://web-mail/content/common/hash.js");
                this.m_scriptLoader.loadSubScript("chrome://web-mail/content/common/base64.js");

                this.m_Log = new DebugLog("webmail.logging.comms",
                                          "{3c8e8390-2cf6-11d9-9669-0800200c9a66}",
                                          "AuthManager");

                this.m_Log.Write("nsHttpAuthManager.js - profile-after-change");
                this.loadDataBase();
            break;

            case "quit-application":
                this.m_Log.Write("nsHttpAuthManager.js - quit-application ");
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
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsHttpAuthManager2]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsHttpAuthManager2]);
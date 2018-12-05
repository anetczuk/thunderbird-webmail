Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");


/***********************  nsWebMailCookieManager ********************************/
function nsWebMailCookieManager2()
{
    this.m_Log = null;
    this.m_dbService = null;
    this.m_dbConn = null;
    this.m_bIsReady = false;
    this.m_scriptLoader = null;
}




nsWebMailCookieManager2.prototype =
{
    classDescription : "Webmail Cookie Manager 2",
    classID          : Components.ID("{7f01c5e0-f729-11db-8314-0800200c9a66}"),
    contractID       : "@mozilla.org/nsWebMailCookieManager2;1",
    _xpcom_categories: [{category: "profile-after-change", service: true}],

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                            Components.interfaces.nsISupports,
                                            Components.interfaces.nsIWebMailCookieManager2]),


    addCookie : function (szUserName, szUrl, szCookie)
    {
        try
        {
            this.m_Log.Write("CookieManager.js - addCookie - START " + szUserName);
            this.m_Log.Write("CookieManager.js - addCookie - cookie " + szCookie);
            this.m_Log.Write("CookieManager.js - addCookie - szUrl " + szUrl);
            if (!szCookie) return false;

            var url = Components.classes["@mozilla.org/network/io-service;1"]
            					.getService(Components.interfaces.nsIIOService)
            					.newURI(szUrl, null, null);
            
            var szDefaultDomain = url.host;
            this.m_Log.Write("CookieManager.js - addCookie - default domain " + szDefaultDomain);
            var Host  = url.host;
            this.m_Log.Write("CookieManager.js - addCookie - default Host " + Host);

            //split into rows
            var aszCookie = szCookie.split(/\n/);
            this.m_Log.Write("CookieManager.js - addCookie - cookie rows " + aszCookie);


            //process cookies
            var aTempCookies = new Array();
            for (i=0; i<aszCookie.length; i++)
            {
                var oNewCookie =this.createCookie(aszCookie[i]);
                if (!oNewCookie.getDomain()) oNewCookie.setDomain(szDefaultDomain);

                var szSQL =null;
                szSQL = "REPLACE INTO webmail_cookies (id, user_name, cookie_domain, cookie_name, cookie_value, cookie_expiry, cookie_secure) " +
                        "VALUES" +
                        "(" +
                        "   (" +
                        "       SELECT id FROM webmail_cookies  " +
                        "       WHERE user_name LIKE ?1 AND cookie_domain LIKE ?2 AND cookie_name LIKE ?3" +
                        "   ), " +
                        "   ?1," +
                        "   ?2," +
                        "   ?3," +
                        "   ?4, " +
                        "   ?5, " +
                        "   ?6 "  +
                        ")";

                var statement = this.m_dbConn.createStatement(szSQL);
                statement.bindStringParameter(0, szUserName.toLowerCase()); //username
                var tempDomain = oNewCookie.getDomain();//.replace(/^\./,"%.");
                statement.bindStringParameter(1, tempDomain);   //cookie domain
                statement.bindStringParameter(2, oNewCookie.getName());     //cookie name
                statement.bindStringParameter(3, oNewCookie.getValue());    //cookie value
                statement.bindStringParameter(4, oNewCookie.getExpiry());   //cookie expiry
                statement.bindStringParameter(5, oNewCookie.getSecure());   //cookie secure
                statement.execute();
            }

            this.m_Log.Write("CookieManager.js - addCookie - END");
            return true;
        }
        catch(e)
        {
             this.m_Log.Write("CookieManger.js: addCookie : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message + " \n"
                                          + e.lineNumber + "\n"
                                          + this.m_dbConn.lastErrorString);
             return false;
        }
    },





    findCookie :  function (szUserName, szUrl)
    {
        try
        {
            this.m_Log.Write("CookieManger.js - findCookie - START " + szUserName);
            this.m_Log.Write("CookieManager.js - findCookie - szUrl " + szUrl);
            
            var url = Components.classes["@mozilla.org/network/io-service;1"]
								.getService(Components.interfaces.nsIIOService)
								.newURI(szUrl, null, null);

            var szDomain = url.host;
            this.m_Log.Write("CookieManger.js - findCookie - domain - " + szDomain);

            var bSecureURL = false;
            if (url.schemeIs("https"))bSecureURL = true;
            this.m_Log.Write("CookieManger.js - findCookie - bSecureURL - " + bSecureURL);

            var iTimeNow = Date.now()/1000;
            this.m_Log.Write("CookieManger.js - findCookie - NOW " + iTimeNow);

            var szCookies = "";
            var szSQL = null;
            szSQL = "SELECT *  " +
                    "FROM webmail_cookies " +
                    "WHERE user_name LIKE ?1 AND (cookie_expiry > ?2 OR  cookie_expiry == -1)";


            var statement = this.m_dbConn.createStatement(szSQL);
            statement.bindStringParameter(0, szUserName.toLowerCase()); //username
            statement.bindStringParameter(1, iTimeNow);                 //time now

            try
            {
                while (statement.executeStep())
                {
                    var szCookieDomain = statement.row["cookie_domain"]
                    if (this.domainCheck(szCookieDomain,szDomain))
                    {
                        var szName = statement.row["cookie_name"];
                        var szValue = statement.row["cookie_value"];
                        var bSecure = statement.row["cookie_secure"];
                        this.m_Log.Write("CookieManger.js - findCookie - cookie - found " + szName + " " + szValue + " " + bSecure );
                        if (bSecureURL== false && bSecure == "true")
                        {
                            this.m_Log.Write("CookieManger.js - findCookie - cookie - secure on unsecure link not adding ");
                        }
                        else
                        {
                            this.m_Log.Write("CookieManger.js - findCookie - cookie - adding ");
                            szCookies +=  szName;
                            szCookies += "=";
                            szCookies +=  szValue;
                            szCookies +=  "; " ;
                        }
                    }
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("CookieManger : findCookie - DB Reset "+ this.m_dbConn.lastErrorString);
            }
           this.m_Log.Write("CookieManger.js - findCookie - szCookies " + szCookies);

            this.m_Log.Write("CookieManger.js - findCookie - END");
            return szCookies;
        }
        catch(e)
        {
            this.m_Log.Write("CookieManger.js: findCookie : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message + " \n"
                                          + e.lineNumber+ "\n"
                                          + this.m_dbConn.lastErrorString);

            return null;
        }
    },



    domainCheck : function (szCookieDomain, szWantedDomain)
    {
        try
        {
            this.m_Log.Write("CookieManger.js - domainCheck - cookie "+szCookieDomain + " wanted " + szWantedDomain);

            var regexp = null;
            var szSubject = null;
            if (szWantedDomain.length > szCookieDomain.length)
            {
                szSubject = szWantedDomain;
                var tempDomain = szCookieDomain.replace(/^\./,"");
                regexp =  new RegExp(tempDomain+"$", "i");
            }
            else
            {
                szSubject = szCookieDomain;
                var tempDomain = szWantedDomain.replace(/^\./,"");
                regexp = new RegExp(tempDomain+"$", "i");
            }

            var bFound = false;
            if (szSubject.search(regexp)!=-1)bFound =  true;

            this.m_Log.Write("CookieManger.js - domainCheck END " +bFound);
            return bFound;
        }
        catch(err)
        {
            this.m_Log.Write("CookieManger.js: domainCheck : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + " \n"
                                          + err.lineNumber);

            return false;
        }
    },





    removeCookie : function (szUserName)
    {
        try
        {
            this.m_Log.Write("CookieManager.js - removeCookie - START " + szUserName);

            var szSQL = "DELETE FROM webmail_cookies WHERE user_name LIKE ?1";
            var statement = this.m_dbConn.createStatement(szSQL);
            statement.bindStringParameter(0, szUserName.toLowerCase());
            statement.execute();
            this.m_Log.Write("CookieManager.js - removeCookie - END");
            return true;
        }
        catch(e)
        {
             this.m_Log.Write("CookieManger.js: removeCookie : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message + " \n"
                                          + e.lineNumber+ "\n"
                                          + this.m_dbConn.lastErrorString);
            return false;
        }
    },



    //private functions

    createCookie : function (szCookie)
    {
        try
        {
            this.m_Log.Write("CookieManager.js - createCookie - START");

            var aData = szCookie.split(";");
            this.m_Log.Write("CookieManager.js - createCookie - aData " + aData);

            var szName = null;
            var oCookie = new Cookie();

            //element 0 is the cookie
            var iNameSplit = aData[0].indexOf("=");
            var szName = (aData[0].substr(0, iNameSplit)).replace(/^[\s]+|[\s]+$/,"");
            var szValue = (aData[0].substr(iNameSplit+1)).replace(/^[\s]+|[\s]+$/,"");;
            this.m_Log.Write("CookieManager.js - createCookie data - szName " + szName + " szValue " + szValue);
            oCookie.setName(szName);
            oCookie.setValue(szValue);

            //rest of cookie data
            for (j=1; j<aData.length; j++)
            {
                //split name and value
                iNameSplit = aData[j].indexOf("=");
                szTempName = (aData[j].substr(0, iNameSplit)).replace(/^[\s]+|[\s]+$/,"");
                szTempValue = (aData[j].substr(iNameSplit+1)).replace(/^[\s]+|[\s]+$/,"");
                this.m_Log.Write("CookieManager.js - createCookie ITEM - name : " + szTempName + "  value : " +szTempValue);

                if (szTempName.search(/^domain$/i)!=-1) //get domain
                {
                    szDomain = szTempValue;
                    this.m_Log.Write("CookieManager.js - createCookie - szDomain " + szDomain);
                    oCookie.setDomain(szDomain);
                }
                else if(szTempName.search(/^path$/i)!=-1) //get path
                {
                    szPath = szTempValue;
                    this.m_Log.Write("CookieManager.js - createCookie - szPath " + szPath);
                    oCookie.setPath(szPath);
                }
                else if (szTempName.search(/^expires$/i)!=-1)//get expiry
                {
                    iExpiry = (Date.parse(szTempValue.replace(/-/g," ")))/1000;
                    this.m_Log.Write("CookieManager.js - createCookie - iExpiry " + iExpiry);
                    oCookie.setExpiry(iExpiry);
                }
                else if (szTempName.search(/^secure$/i)!=-1 ||
                		 (szTempValue.search(/^secure$/i)!=-1 && iNameSplit ==-1))//get secure boolean
                {
                    bSecure = true;
                    this.m_Log.Write("CookieManager.js - createCookie - bSecure " + bSecure);
                    oCookie.setSecure(bSecure);
                }
                else if (szTempName.search(/^httponly$/i)!=-1)//get httponly boolean
                {
                }
                else if (szTempName.search(/^version$/i)!=-1) //get version
                {
                    this.m_Log.Write("CookieManager.js - createCookie - Version " + szValue);
                    oCookie.setVersion(szValue);
                }
            }

            this.m_Log.Write("CookieManager.js - createCookie - END");
            return oCookie;
        }
        catch(e)
        {
             this.m_Log.Write("CookieManger.js: createCookie : Exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message + " \n"
                                          + e.lineNumber+ "\n"
                                          + this.m_dbConn.lastErrorString);
            return null;
        }
    },




    loadDataBase : function()
    {
        try
        {
            this.m_Log.Write("CookieManager.js - loadDataBase - START");

            try
            {
                this.m_dbService = Components.classes["@mozilla.org/storage/service;1"]
                                             .getService(Components.interfaces.mozIStorageService);
            }
            catch(err)
            {
                this.m_Log.Write("CookieManager.js : startUp - SQL components NOT installed");
                throw new Error("no database");
            }

            //load DB
/*
            var fileDB = Components.classes["@mozilla.org/file/directory_service;1"];
            fileDB = fileDB.createInstance(Components.interfaces.nsIProperties);
            fileDB = fileDB.get("ProfD", Components.interfaces.nsILocalFile);
            fileDB.append("WebmailData");         //add folder
            if (!fileDB.exists())    //check folder exist
                fileDB.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0664);
            fileDB.append("cookies.db3");         //sqlite database
            fileDB.QueryInterface(Components.interfaces.nsIFile)
            this.m_Log.Write("CookieManager.js - loadDB - fileDB "+ fileDB.path);
            this.m_dbConn = this.m_dbService.openDatabase(fileDB);
*/
            this.m_dbConn = this.m_dbService.openSpecialDatabase("memory");
            if (!this.m_dbConn) return false;

            this.createDB();

            this.m_bIsReady = true;

            this.m_Log.Write("CookieManager.js - loadDataBase - END");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("CookieManager.js: loadDataBase : Exception : "
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
            this.m_Log.Write("CookieManager.js - createDB - START");
            var szSQL;

            //account table
            szSQL = "CREATE TABLE webmail_cookies " +
                    "(" +
                       "id INTEGER PRIMARY KEY AUTOINCREMENT, "+
                        "user_name TEXT, " +
                        "cookie_domain TEXT," +
                        "cookie_name TEXT," +
                        "cookie_value TEXT," +
                        "cookie_expiry INTEGER," +
                        "cookie_path TEXT," +
                        "cookie_version INTEGER," +
                        "cookie_secure BOOLEAN" +
                    ");";
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("CookieManager.js - createDB - szSQL " + szSQL);

            this.m_Log.Write("CookieManager.js - createDB - END");

        }
        catch(err)
        {
            this.m_Log.DebugDump("CookieManager.js: createDB : Exception : "
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
                this.m_scriptLoader.loadSubScript("chrome://web-mail/content/common/Cookie.js");
                this.m_Log = new DebugLog("webmail.logging.comms",
                                          "{3c8e8390-2cf6-11d9-9669-0800200c9a66}",
                                          "CookieManager");

                this.m_Log.Write("CookieManager.js - profile-after-change");
                this.loadDataBase();
            break;

            case "quit-application":
                this.m_Log.Write("CookieManager.js - quit-application ");
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
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsWebMailCookieManager2]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsWebMailCookieManager2]);


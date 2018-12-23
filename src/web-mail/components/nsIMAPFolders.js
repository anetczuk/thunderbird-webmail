Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");


/***********************  UriManager ********************************/
function nsIMAPFolders()
{
    this.m_scriptLoader = null;
    this.m_Log = null;
    this.m_dbService = null;
    this.m_dbConn = null;
    this.m_dbConnDummy = null;
    this.m_iCurrentDBVersion = 1;
    this.m_bIsReady = false;
    this.m_iSession = 0;
}


nsIMAPFolders.prototype =
{
    classDescription : "Webmail IMAP Folders",
    classID          : Components.ID("{9433ab20-f658-11da-974d-0800200c9a66}"),
    contractID       : "@mozilla.org/nsIMAPFolders;1",
    _xpcom_categories: [{category: "profile-after-change", service: true}],

    QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                            Components.interfaces.nsISupports,
                                            Components.interfaces.nsIIMAPFolders]),


    loadDataBase : function()
    {
        try
        {
            this.m_Log.Write("nsIMAPFolders.js - loadDataBase - START");

            try
            {
                this.m_dbService = Components.classes["@mozilla.org/storage/service;1"]
                                             .getService(Components.interfaces.mozIStorageService);
            }
            catch(err)
            {
                this.m_Log.Write("nsIMAPFolders.js : startUp - SQL components NOT installed");
                throw new Error("no database");
            }

            //get location of DB
            var fileDB = Components.classes["@mozilla.org/file/directory_service;1"];
            fileDB = fileDB.createInstance(Components.interfaces.nsIProperties);
            fileDB = fileDB.get("ProfD", Components.interfaces.nsIFile);
            fileDB.append("WebmailData");         //add folder
            if (!fileDB.exists() || !fileDB.isDirectory())    //check folder exist
                fileDB.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o764);
            if (fileDB.exists() && fileDB.isDirectory() && fileDB.permissions != 0o764) //check permissions
            {
                this.m_Log.Write("nsIMAPFolders.js - loadDB - updating file permissions");
                try
                {
                    fileDB.permissions = 0o764;
                }
                catch(e)
                {
                    this.m_Log.Write("nsIMAPFolders.js: loadDataBase : permissions exception : "
                                          + e.name
                                          + ".\nError message: "
                                          + e.message);
                }
            }

            fileDB.append("imapdata.db3");         //sqlite database
            fileDB.QueryInterface(Components.interfaces.nsIFile)
            this.m_Log.Write("nsIMAPFolders.js - loadDB - fileDB "+ fileDB.path);

            //load DB
            this.m_dbConn = this.m_dbService.openDatabase(fileDB);
            if (!this.m_dbConn) return false;

            var iVersion = this.getDBVersion();
            if (iVersion == -1)
                this.createDB();
            else if (iVersion != this.m_iCurrentDBVersion)
                this.updateDB(iVersion);

            this.m_iSession = this.getSession();

            this.m_bIsReady = true;

            this.m_Log.Write("nsIMAPFolders.js - loadDataBase - END");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolders.js: loadDataBase : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber);

            return false;
        }
    },




    getDBVersion : function ()
    {
        try
        {
            this.m_Log.Write("nsIMAPFolders.js - getDBVersion - START");

            var iVersion = -1;

            try
            {
                var szVersion = "SELECT version FROM imap_schema_version LIMIT 1";
                var statement = this.m_dbConn.createStatement(szVersion);
                try
                {
                    if (statement.executeStep()) iVersion = statement.row["version"];
                }
                finally
                {
                    statement.reset();
                    this.m_Log.Write("nsIMAPFolders : getDBversion - DB Reset");
                }
            }
            catch (e)
            {
                iVersion = -1;
            }

            this.m_Log.Write("nsIMAPFolders.js - getDBVersion - "+ iVersion);
            this.m_Log.Write("nsIMAPFolders.js - getDBVersion - END");
            return iVersion;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolders.js: getDBVersion : Exception : "
                                          + err.name
                                          + "\nError message: "
                                          + err.message +"\n"
                                          + err.lineNumber+ "\n"
                                          + this.m_dbConn.lastErrorString);
            return -1;
        }
    },




    createDB : function ()
    {
        try
        {
            this.m_Log.Write("nsIMAPFolders.js - createDB - START");
            var szSQL;

            //dummy table
            szSQL = "CREATE TABLE dummy_table (id INTEGER PRIMARY KEY);";
            this.m_Log.Write("nsIMAPFolders.js - createDB - szSQL " + szSQL);
            this.m_dbConn.executeSimpleSQL(szSQL);
            szSQL = "INSERT OR IGNORE INTO dummy_table VALUES (1)";
            this.m_dbConn.executeSimpleSQL(szSQL);


            //Version table
            szSQL = "CREATE TABLE imap_schema_version (version INTEGER);";
            this.m_dbConn.executeSimpleSQL(szSQL);
            szSQL = "INSERT INTO imap_schema_version VALUES(1);";
            this.m_dbConn.executeSimpleSQL(szSQL);


            //session table
            szSQL = "CREATE TABLE session ";
            szSQL +="(";
            szSQL +=    "id INTEGER PRIMARY KEY, ";
            szSQL +=    "session INTEGER ";
            szSQL +=");";
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("nsIMAPFolders.js - createDB - szSQL " + szSQL);
            szSQL = "INSERT INTO session (id ,session) VALUES (1, 1)";
            this.m_dbConn.executeSimpleSQL(szSQL);


            //account table
            szSQL = "CREATE TABLE imap_accounts ";
            szSQL +="(";
            szSQL +=    "id INTEGER PRIMARY KEY AUTOINCREMENT, ";
            szSQL +=    "account_name TEXT ";
            szSQL +=");";
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("nsIMAPFolders.js - createDB - szSQL " + szSQL);


            //subscribed folder list
            szSQL = "CREATE TABLE subscribed_folders ";
            szSQL +="(";
            szSQL +=    "id INTEGER PRIMARY KEY AUTOINCREMENT, ";
            szSQL +=    "account_id INTEGER, ";
            szSQL +=    "folder_hierarchy TEXT ";
            szSQL +=");";
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("nsIMAPFolders.js - createDB - szSQL " + szSQL);


            //folder table
            szSQL = "CREATE TABLE folders ";
            szSQL +="(";
            szSQL +=    "id INTEGER PRIMARY KEY AUTOINCREMENT, ";
            szSQL +=    "account_id INTEGER, ";
            szSQL +=    "folder_hierarchy TEXT, ";
            szSQL +=    "folder_url TEXT, ";
            szSQL +=    "session INTEGER ";
            szSQL +=");";
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("nsIMAPFolders.js - createDB - szSQL " + szSQL);



            //message table
            szSQL = "CREATE TABLE messages ";
            szSQL +="(";
            szSQL +=    "id INTEGER PRIMARY KEY AUTOINCREMENT, ";
            szSQL +=    "account_id INTEGER, ";
            szSQL +=    "folder_id INTEGER,"
            szSQL +=    "href TEXT,";
            szSQL +=    "uid TEXT,";
            szSQL +=    "recipient TEXT,";
            szSQL +=    "sender TEXT,";
            szSQL +=    "subject TEXT,";
            szSQL +=    "date TEXT,";
            szSQL +=    "size TEXT,";
            szSQL +=    "read BOOLEAN,";
            szSQL +=    "deleted BOOLEAN,";
            szSQL +=    "session INTEGER";
            szSQL +=");";
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("nsIMAPFolders.js - createDB - szSQL " + szSQL);


            //folder update table
            szSQL  =  "CREATE TABLE last_folder_update  ";
            szSQL += "( " ;
            szSQL += "    id INTEGER PRIMARY KEY, ";
            szSQL += "    account_id INTEGER, ";
            szSQL += "    folder_id INTEGER, ";
            szSQL += "    session INTEGER, " ;
            szSQL += "    date DATE ";
            szSQL += ")";
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("nsIMAPFolders.js - createDB - szSQL " + szSQL);


            //trigger on Insert in messages
            szSQL  = "CREATE TRIGGER trigger_insert_messages INSERT ON messages "
            szSQL += "BEGIN ";
            szSQL += "     REPLACE INTO last_folder_update (id , account_id, folder_id, session,date) ";
            szSQL += "     VALUES ";
            szSQL += "     ( ";
            szSQL += "           (SELECT id ";
            szSQL += "             FROM last_folder_update ";
            szSQL += "            WHERE account_id = NEW.account_id AND ";
            szSQL += "                   folder_id = NEW.folder_id ";
            szSQL += "            ),";
            szSQL += "            NEW.account_id, ";
            szSQL += "            NEW.folder_id, ";
            szSQL += "            NEW.session, ";
            szSQL += "            current_timestamp ";
            szSQL += "     ); ";
            szSQL += "END"
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("nsIMAPFolders.js - createDB - szSQL " + szSQL);


            //Table last_user_update
            szSQL  = "CREATE TABLE last_user_update ";
            szSQL += "( ";
            szSQL += "   id INTEGER PRIMARY KEY, "
            szSQL += "   account_id INTEGER, "
            szSQL += "   session INTEGER, "
            szSQL += "   date DATE "
            szSQL += ")";
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("nsIMAPFolders.js - createDB - szSQL " + szSQL);


            szSQL  = "CREATE TRIGGER trigger_insert_folders INSERT ON folders "
            szSQL += "BEGIN ";
            szSQL += "     REPLACE INTO last_user_update (id, account_id, session, date) ";
            szSQL += "     VALUES ";
            szSQL += "     ( ";
            szSQL += "          (SELECT id ";
            szSQL += "           FROM last_user_update ";
            szSQL += "           WHERE account_id = NEW.account_id ";
            szSQL += "           LIMIT 1 ";
            szSQL += "          ), ";
            szSQL += "          NEW.account_id, ";
            szSQL += "          NEW.session, ";
            szSQL += "          current_timestamp ";
            szSQL += "     ); ";
            szSQL += "END"
            this.m_dbConn.executeSimpleSQL(szSQL);
            this.m_Log.Write("nsIMAPFolders.js - createDB - szSQL " + szSQL);


            this.m_Log.Write("nsIMAPFolders.js - createDB - END");

        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolders.js: createDB : Exception : "
                                          + err.name +
                                          "\nError message: "
                                          + err.message +"\n"
                                          + "DB Error " + "\n"
                                          + err.lineNumber+ "\n"
                                          + this.m_dbConn.lastErrorString);
            return false;
        }
    },




    getSession : function ()
    {
        try
        {
            this.m_Log.Write("nsIMAPFolders.js - getSession - START");

            var iSession = 0;

            var szSQL = "SELECT session FROM session"
            var statement = this.m_dbConn.createStatement(szSQL);
            try
            {
                if (statement.executeStep()) iSession = statement.row["session"];
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsIMAPFolders : getSession - DB Reset");
            }

            iSession++;

            szSQL = "REPLACE INTO session (id, session) VALUES (1, :session)";
            statement = this.m_dbConn.createStatement(szSQL);
            statement.params.session = iSession;
            statement.execute();

            this.m_Log.Write("nsIMAPFolders.js - getSession - END " + iSession);
            return iSession;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolders.js: createDB : Exception : "
                                          + err.name +
                                          "\nError message: "
                                          + err.message +"\n"
                                          + "DB Error " + "\n"
                                          + err.lineNumber+ "\n"
                                          + this.m_dbConn.lastErrorString);
            return 0;
        }
    },



    createUser : function (szUserName)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolders.js - createUser - START");
            this.m_Log.Write("nsIMAPFolders.js - createUser - " +szUserName);

            var szSQL = "REPLACE INTO imap_accounts (id, account_name) ";
            szSQL    += "VALUES ";
            szSQL    += "(" ;
            szSQL    += "  (SELECT id FROM imap_accounts WHERE account_name LIKE :user),";
            szSQL    += "  :user";
            szSQL    += ");";

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUserName.toLowerCase();
            statement.execute();

            this.m_Log.Write("nsIMAPFolders.js - createUser - END");
        }
        catch(e)
        {
            this.m_Log.DebugDump("nsIMAPFolders.js: createUser : Exception : "
                                          + e.name +
                                          ".\nError message: "
                                          + e.message+ "\n"
                                          + e.lineNumber+ "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    listSubscribed : function (szAddress, iCount, aszFolders)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - listSubscribed - Start");
            this.m_Log.Write("nsIMAPFolder.js - listSubscribed - "+szAddress);

            var bReturn = false;
            var szSQL = "SELECT subscribed_folders.folder_hierarchy "
            szSQL    += "FROM subscribed_folders, imap_accounts, folders ";
            szSQL    += "WHERE imap_accounts.account_name LIKE :address AND " +
                        "      imap_accounts.id = subscribed_folders.account_id  AND " +
                        "      subscribed_folders.folder_hierarchy LIKE folders.folder_hierarchy  AND " +
                        "      folders.session = :session "
            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.address = szAddress.toLowerCase();
            statement.params.session = this.m_iSession;

            var aResult = new Array();
            try
            {
                while (statement.executeStep())
                {
                   aResult.push(statement.row["folder_hierarchy"]);
                   bReturn = true;
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsIMAPFolder : listSubscribed - DB Reset "+ this.m_dbConn.lastErrorString);
            }

            iCount.value = aResult.length;
            aszFolders.value = aResult;
            bReturn = true;

            this.m_Log.Write("nsIMAPFolder.js - listSubscribed - " + iCount.value + " " + aszFolders.value);
            this.m_Log.Write("nsIMAPFolder.js - listSubscribed - End");
            return bReturn;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: listSubscribed : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber+ "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    subscribeFolder :function (szAddress, szFolder)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - subscribeFolder - Start");
            this.m_Log.Write("nsIMAPFolder.js - subscribeFolder - "+szAddress + " " + szFolder);

            var bReturn = false;

            var szSQL = "REPLACE INTO subscribed_folders (id, account_id, folder_hierarchy) ";
            szSQL    += "VALUES ";
            szSQL    += "(";
            szSQL    += "   (";
            szSQL    += "        SELECT subscribed_folders.id " +
                                 "FROM subscribed_folders, imap_accounts " +
                                 "WHERE imap_accounts.account_name  LIKE :address AND " +
                                       "imap_accounts.id = subscribed_folders.account_id  AND " +
                                       "subscribed_folders.folder_hierarchy  = :folder";
            szSQL    += "    ),"
            szSQL    += "    ("
            szSQL    += "        SELECT imap_accounts.id " +
                                 "FROM imap_accounts " +
                                 "WHERE imap_accounts.account_name LIKE :address " +
                                 "LIMIT 1"
            szSQL    += "     ),";
            szSQL    += "     :folder";
            szSQL    += ")"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.address = szAddress.toLowerCase();
            statement.params.folder = szFolder;
            statement.execute();

            this.m_Log.Write("nsIMAPFolder.js - subscribeFolder - End");
            return bReturn;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: subscribeFolder : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber+ "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    unsubscribeFolder : function (szAddress, szFolder)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - unsubscribeFolder - Start");
            this.m_Log.Write("nsIMAPFolder.js - unsubscribeFolder - "+szAddress + " " + szFolder);

            var bFound = true;
            var szSQL = "DELETE FROM subscribed_folders ";
            szSQL   +=  "WHERE account_id = (SELECT id FROM imap_accounts WHERE account_name LIKE :address) AND folder_hierarchy = :folder";
            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.address = szAddress.toLowerCase();
            statement.params.folder = szFolder;
            statement.execute();

            this.m_Log.Write("nsIMAPFolder.js - unsubscribeFolder - End");
            return bFound;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: unsubscribeFolder : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber+ "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    addFolder : function (szUser, szHiererchy, szHref)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - addFolder - Start");
            this.m_Log.Write("nsIMAPFolder.js - addFolder - "+ szUser + " " + szHiererchy + " " + szHref);

            var szSQL = "REPLACE INTO folders (id, account_id, folder_hierarchy, folder_url, session) "
            szSQL    += "VALUES ";
            szSQL    += "(";
            szSQL    += "   (";
            szSQL    += "        SELECT folders.id " +
                                 "FROM folders, imap_accounts " +
                                 "WHERE imap_accounts.account_name LIKE :user AND " +
                                       "imap_accounts.id = folders.account_id  AND " +
                                       "folders.folder_hierarchy  = :hierarchy";
            szSQL    += "    ),"
            szSQL    += "    ("
            szSQL    += "        SELECT imap_accounts.id  " +
                                 "FROM imap_accounts " +
                                 "WHERE imap_accounts.account_name LIKE :user " +
                                 "LIMIT 1"
            szSQL    += "     ),";
            szSQL    += "     :hierarchy,";
            szSQL    += "     :href,";
            szSQL    += "     :session";
            szSQL    += ");"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser.toLowerCase();
            statement.params.hierarchy = szHiererchy;
            statement.params.href = szHref;
            statement.params.session = this.m_iSession;
            statement.execute();

            this.m_Log.Write("nsIMAPFolder.js - addFolder - End");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: addFolder : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber+ "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    deleteFolder : function (szUser, szHiererchy)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - deleteFolder - Start");
            this.m_Log.Write("nsIMAPFolder.js - deleteFolder - "+ szUser + " " + szHiererchy);

            var szSQL = "DELETE FROM folders "
            szSQL    += "WHERE (account_id = (SELECT id FROM imap_accounts WHERE account_name LIKE :user)) AND folder_hierarchy LIKE :hierarchy "

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser.toLowerCase();
            statement.params.hierarchy = szHiererchy;
            statement.execute();

            this.m_Log.Write("nsIMAPFolder.js - deleteFolder - End");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: deleteFolder : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber + "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    renameFolder : function (szUser, szOldHierarchy, szNewHierarchy, szNewHref)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - renameFolder - Start");
            this.m_Log.Write("nsIMAPFolder.js - renameFolder - "+ szUser + " " + szOldHierarchy + " " + szNewHierarchy + " " + szNewHref);

            var szSQL = "UPDATE folders ";
            szSQL    += "SET folder_hierarchy = :new_hierarchy, " +
                            "folder_url = :new_href ";
            szSQL    += "WHERE id = ( SELECT folders.id " +
                                     "FROM folders, imap_accounts " +
                                     "WHERE imap_accounts.account_name LIKE :user AND " +
                                     "      imap_accounts.id = folders.account_id  AND " +
                                     "      folders.folder_hierarchy  = :old_hierarchy " +
                                    ");"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser.toLowerCase();
            statement.params.old_hierarchy = szOldHierarchy;
            statement.params.new_hierarchy = szNewHierarchy;
            statement.params.new_href = szNewHref;
            statement.execute();


            this.m_Log.Write("nsIMAPFolder.js - renameFolder - End");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: renameFolder : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber + "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    getHierarchies : function (szUser, szHierarchy ,iCount, aszFolders)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - getAllHiererchy - START");
            this.m_Log.Write("nsIMAPFolder.js - getAllHiererchy - " + szUser + " " +szHierarchy);
            if (!szHierarchy) throw new Error("no szHierarchy");
            if (szHierarchy.search(/INBOX/)==-1) throw new Error("searching not for inbox");

            var bResult = false;
            var aResult = new Array();
            var szSQL;
            var statement;


            if (szHierarchy.search(/INBOX\.(.*?)\.\*|\%$/)!=-1)
            {
                var aHierarchy = szHierarchy.split(/\./);
                this.m_Log.Write("nsIMAPFolder.js - getAllHiererchy - aHierarchy " + aHierarchy);
                szHierarchy =  aHierarchy[0] + "."+ aHierarchy[1];
                this.m_Log.Write("nsIMAPFolder.js - getAllHiererchy - szHierarchy " + szHierarchy);
            }

            if (szHierarchy.search(/INBOX\.\*|\%$/)!=-1)
            {
                this.m_Log.Write("nsIMAPFolder.js - getAllHiererchy - wildcard ");
                szSQL  = "SELECT folder_hierarchy "
                szSQL += "FROM folders, imap_accounts "
                szSQL += "WHERE folders.account_id = imap_accounts.id AND " +
                                "imap_accounts.account_name LIKE :user AND " +
                                "session = :session"
                statement = this.m_dbConn.createStatement(szSQL);
                statement.params.user = szUser;
                statement.params.session = this.m_iSession;
            }
            else
            {
                szSQL  = "SELECT folder_hierarchy "
                szSQL += "FROM folders, imap_accounts "
                szSQL += "WHERE folders.account_id = imap_accounts.id AND " +
                                "imap_accounts.account_name LIKE :user AND " +
                                "folder_hierarchy LIKE :hierarchy AND " +
                                "session = :session"
                statement = this.m_dbConn.createStatement(szSQL);
                statement.params.user = szUser;
                statement.params.hierarchy = szHierarchy;
                statement.params.session = this.m_iSession;
            }

            try
            {
                while (statement.executeStep())
                {
                   aResult.push(statement.row["folder_hierarchy"]);
                   bResult = true;
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsIMAPFolder : getAllHiererchy - DB Reset "+ this.m_dbConn.lastErrorString);
            }


            iCount.value = aResult.length;
            aszFolders.value = aResult;
            this.m_Log.Write("nsIMAPFolder.js - getAllHiererchy - " + iCount.value + " " + aszFolders.value);
            this.m_Log.Write("nsIMAPFolder.js - getAllHiererchy - End");
            return bResult;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: getAllHiererchy : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber + "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    getFolderDetails : function (szUser, szHierarchy, szHref, szUID, iMSGCount, iUnreadCount, iExpungeCount)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - getFolderDetails - Start");
            this.m_Log.Write("nsIMAPFolder.js - getFolderDetails - " + szUser + " " + szHierarchy);

            var bResult = false;

            var szSQL = "SELECT folders.id, " +
                               "folders.folder_url," +
                               "(    SELECT COUNT(*) "+
                                "    FROM messages, folders, imap_accounts " +
                                "    WHERE folders.account_id = imap_accounts.id AND " +
                                "          messages.account_id = imap_accounts.id AND"+
                                "          imap_accounts.account_name LIKE :user AND "+
                                "          folders.id = messages.folder_id AND "+
                                "          folders.folder_hierarchy LIKE :hierarchy AND " +
                                "          messages.session = :session AND " +
                                "          messages.deleted = \"false\" " +
                                ") AS message_count, " +
                                "(   SELECT COUNT(*) " +
                                "    FROM messages, folders, imap_accounts " +
                                "    WHERE folders.account_id = imap_accounts.id AND " +
                                "          messages.account_id = imap_accounts.id AND"+
                                "          imap_accounts.account_name LIKE :user AND " +
                                "          folders.id = messages.folder_id AND "+
                                "          folders.folder_hierarchy LIKE :hierarchy AND " +
                                "          messages.read = \"false\" AND " +
                                "          messages.deleted = \"false\" AND " +
                                "          messages.session = :session " +
                                ") AS read_count, " +
                                "(   SELECT COUNT(*) " +
                                    "FROM messages, folders, imap_accounts " +
                                    "WHERE folders.account_id = imap_accounts.id AND " +
                                          "messages.account_id = imap_accounts.id AND " +
                                          "imap_accounts.account_name LIKE :user AND " +
                                          "folders.id = messages.folder_id AND " +
                                          "folders.folder_hierarchy LIKE :hierarchy AND " +
                                          "messages.deleted = \"true\" AND " +
                                          "messages.session = :session " +
                                ") AS expunge_count ";
            szSQL    += "FROM folders, imap_accounts "
            szSQL    += "WHERE folders.account_id = imap_accounts.id AND " +
                              "imap_accounts.account_name LIKE :user AND " +
                              "folders.folder_hierarchy LIKE :hierarchy AND " +
                              "folders.session = :session "
            szSQL    += "LIMIT 1;"


            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser;
            statement.params.hierarchy = szHierarchy;
            statement.params.session = this.m_iSession;

            try
            {
                while (statement.executeStep())
                {
                    szUID.value = statement.row["id"];
                    this.m_Log.Write("nsIMAPFolder.js - getFolderDetails - "+ szUID.value);
                    szHref.value = statement.row["folder_url"];
                    this.m_Log.Write("nsIMAPFolder.js - getFolderDetails - " + szHref.value);
                    iMSGCount.value =  statement.row["message_count"];
                    this.m_Log.Write("nsIMAPFolder.js - getFolderDetails - " + iMSGCount.value);
                    iUnreadCount.value =  statement.row["read_count"];
                    this.m_Log.Write("nsIMAPFolder.js - getFolderDetails - " + iUnreadCount.value);
                    iExpungeCount.value =  statement.row["expunge_count"];
                    this.m_Log.Write("nsIMAPFolder.js - getFolderDetails - " + iExpungeCount.value);
                    bResult = true;
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsIMAPFolder : getAllHiererchy - DB Reset "+ this.m_dbConn.lastErrorString);
            }

            this.m_Log.Write("nsIMAPFolder.js - getFolderDetails - End " +bResult);
            return bResult;
        }
        catch(err)
        {
             this.m_Log.DebugDump("nsIMAPFolder.js: getFolderDetails : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber + "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    addMSG : function (szUser, szHierarchy, szHref, szUID, bRead, szTo, szFrom, szSubject, szDate, iSize)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - addMSG - Start");
            this.m_Log.Write("nsIMAPFolder.js - addMSG - " + szUser + " " + szHierarchy + " " + szHref + " " + szUID + " " + bRead +" "
                                                           + szTo + " " + szFrom + " " + szSubject + " " + szDate + " " + iSize);
            var bResult = false;

            var szSQL = "REPLACE INTO messages " ;
            szSQL    +=         "(id, account_id, folder_id, uid, href, recipient, sender, subject, date, size, read, deleted ,session) "
            szSQL    += "VALUES ";
            szSQL    += "(";
            szSQL    += "    (" +
                                "SELECT messages.id " +
                                "FROM messages, imap_accounts, folders " +
                                "WHERE messages.account_id = imap_accounts.id  AND  " +
                                      "imap_accounts.id = folders.account_id  AND " +
                                      "imap_accounts.account_name LIKE :user AND " +
                                      "messages.folder_id = folders.id AND " +
                                      "folders.folder_hierarchy LIKE :hierarchy AND " +
                                      "messages.uid = :uid AND " +
                                      "messages.deleted = \"false\" " +
                                "LIMIT 1 "
            szSQL    += "    ),"
            szSQL    += "    (" +
                                 "SELECT imap_accounts.id  " +
                                 "FROM imap_accounts " +
                                 "WHERE imap_accounts.account_name LIKE :user " +
                                 "LIMIT 1 "
            szSQL    += "     ),";
            szSQL    += "    (" +
                                 "SELECT folders.id " +
                                 "FROM folders, imap_accounts " +
                                 "WHERE imap_accounts.account_name LIKE :user AND " +
                                       "imap_accounts.id = folders.account_id AND " +
                                       "folders.folder_hierarchy LIKE :hierarchy " +
                                 "LIMIT 1 "
            szSQL    += "     ),"
            szSQL    += "     :uid,";
            szSQL    += "     :href,";
            szSQL    += "     :to_param,";
            szSQL    += "     :from_param,";
            szSQL    += "     :subject,";
            szSQL    += "     :date,";
            szSQL    += "     :size,";
            szSQL    += "     :read,";
            szSQL    += "     :param1,";
            szSQL    += "     :session";
            szSQL    += ");"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser;
            statement.params.hierarchy = szHierarchy;
            statement.params.uid = szUID;
            statement.params.href = szHref;
            statement.params.to_param = szTo;
            statement.params.from_param = szFrom;
            statement.params.subject = szSubject;
            statement.params.date = szDate;
            statement.params.size = iSize;
            statement.params.read = bRead;
            statement.params.param1 = "false";
            statement.params.session = this.m_iSession;
            statement.execute();

            this.m_Log.Write("nsIMAPFolder.js - addMSG - End " +bResult);
            return bResult;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: addMSG : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber + "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    copyMSG : function (szUser , szUID, szOldHierarchy, szNewHierarchy)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - copyMSG - Start");
            this.m_Log.Write("nsIMAPFolder.js - copyMSG - " + szUser + " " + szOldHierarchy + " " + szUID + " " +szNewHierarchy);
            var bResult = false;

            var szSQL ="SELECT  messages.href," +
                               "messages.recipient," +
                               "messages.sender, " +
                               "messages.subject, " +
                               "messages.date, " +
                               "messages.size, " +
                               "messages.read, " +
                               "messages.uid "
            szSQL   += "FROM folders, imap_accounts, messages "
            szSQL   += "WHERE  folders.account_id = imap_accounts.id AND " +
                              "messages.account_id =  imap_accounts.id AND " +
                              "imap_accounts.account_name LIKE :user AND " +
                              "folders.id = messages.folder_id AND " +
                              "folders.folder_hierarchy LIKE :hierarchy AND  " +
                              "messages.session = :session AND " +
                              "messages.id= :uid "
            szSQL   += "LIMIT 1"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser;
            statement.params.hierarchy = szOldHierarchy;
            statement.params.session = this.m_iSession;
            statement.params.uid = szUID;

            var szHref = null;
            var szTo = null;
            var szFrom = null;
            var szSubject = null;
            var szDate = null;
            var iSize = 0;
            var bRead = false;

            try
            {
                while (statement.executeStep())
                {
                   szHref = statement.row["href"];
                   szTo = statement.row["recipient"];
                   szFrom = statement.row["sender"];
                   szSubject = statement.row["subject"];
                   szDate = statement.row["date"];
                   iSize = Number(statement.row["size"]);
                   var szRead = statement.row["read"];
                   bRead = (szRead.search(/true/i)!=-1) ? true : false;
                   szMSGID = statement.row["uid"];
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsIMAPFolder : copyMSG - DB Reset "+ this.m_dbConn.lastErrorString);
            }


            bResult = this.addMSG(szUser, szNewHierarchy, szHref, szMSGID, bRead, szTo, szFrom, szSubject, szDate, iSize);

            this.m_Log.Write("nsIMAPFolder.js - copyMSG - END " + bResult);
            return bResult;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: copyMSG : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber + "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    getRangeMSGIDs : function (szUser, szHierarchy, iMinID, iMaxID, iCount, aiIDs)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - getMSGUIDS - Start");
            this.m_Log.Write("nsIMAPFolder.js - getMSGUIDS - " + szUser + " " + szHierarchy + " " + iMinID + " " + iMaxID);

            var bResult = false;
            var aResults = new Array();

            var szSQL  = "SELECT messages.id "
            szSQL     += "FROM messages, imap_accounts, folders "
            szSQL     += "WHERE folders.account_id = imap_accounts.id AND " +
                        "       imap_accounts.account_name LIKE :user AND " +
                        "       folders.id = messages.folder_id AND " +
                        "       folders.folder_hierarchy LIKE :hierarchy AND " +
                        "       messages.session = :session AND" +
                        "       messages.id >= :min_uid ";
            if (iMaxID != -1) szSQL += " AND messages.id <= :max_uid "
            szSQL    += "ORDER BY messages.id ASC ";
            this.m_Log.Write("nsIMAPFolder.js - getMSGUIDS - " + szSQL);

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser;
            statement.params.hierarchy = szHierarchy;
            statement.params.session = this.m_iSession;
            statement.params.min_uid = iMinID;
            if (iMaxID != -1) statement.params.max_uid = iMaxID;

            try
            {
                while (statement.executeStep())
                {
                   aResults.push(statement.row["id"])
                   bResult = true;
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsIMAPFolder : getAllHiererchy - DB Reset "+ this.m_dbConn.lastErrorString);
            }

            iCount.value = aResults.length;
            aiIDs.value = aResults;
            this.m_Log.Write("nsIMAPFolder.js - getMSGUIDS - End " +bResult + " " + aiIDs.value);
            this.m_Log.Write("nsIMAPFolder.js - getMSGUIDS - End ");
            return bResult;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: getMSGUIDS : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber + "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },





    getMSGHeaders : function (szUser, szHierarchy, szUID, szHref, bRead, bDelete, szTo, szFrom, szSubject, szDate, iSize, iSeqNum)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - getMSG - Start");
            this.m_Log.Write("nsIMAPFolder.js - getMSG - " + szUser + " " + szHierarchy + " " + szUID);
            var bResult = false;

            var szSQL ="SELECT  messages.href," +
                               "messages.recipient," +
                               "messages.sender, " +
                               "messages.subject, " +
                               "messages.date, " +
                               "messages.size, " +
                               "messages.read, " +
                               "messages.deleted, " +
                               "(  SELECT COUNT(*) " +
                               "   FROM messages, folders, imap_accounts " +
                               "   WHERE folders.account_id = imap_accounts.id AND " +
                               "         messages.account_id = imap_accounts.id AND " +
                               "         imap_accounts.account_name LIKE :user AND " +
                               "         messages.folder_id = folders.id AND " +
                               "         folders.folder_hierarchy LIKE :hierarchy AND " +
                               "         messages.session = :session AND " +
                               "         messages.id <= :uid" +
                               ") AS sequence_number "
            szSQL   += "FROM folders, imap_accounts, messages "
            szSQL   += "WHERE  folders.account_id = imap_accounts.id AND " +
                              "messages.account_id =  imap_accounts.id AND " +
                              "imap_accounts.account_name LIKE :user AND " +
                              "folders.id = messages.folder_id AND " +
                              "folders.folder_hierarchy LIKE :hierarchy AND  " +
                              "messages.session = :session AND " +
                              "messages.id= :uid "
            szSQL   += "LIMIT 1"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser;
            statement.params.hierarchy = szHierarchy;
            statement.params.session = this.m_iSession;
            statement.params.uid = szUID;

            try
            {
                while (statement.executeStep())
                {
                   szHref.value = statement.row["href"];
                   szTo.value = statement.row["recipient"];
                   szFrom.value = statement.row["sender"];
                   szSubject.value = statement.row["subject"];
                   szDate.value = statement.row["date"];
                   iSize.value = Number(statement.row["size"]);
                   var szRead = statement.row["read"];
                   bRead.value = (szRead.search(/true/i)!=-1) ? true : false;
                   var szDeleted = statement.row["deleted"];
                   bDelete.value = (szDeleted.search(/true/i)!=-1) ? true : false;
                   iSeqNum.value =  Number(statement.row["sequence_number"]);
                   bResult = true;
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsIMAPFolder : getMSG - DB Reset "+ this.m_dbConn.lastErrorString);
            }

            this.m_Log.Write("nsIMAPFolder.js - getMSG - END " +bResult);
            return bResult;
        }
        catch(err)
        {
             this.m_Log.DebugDump("nsIMAPFolder.js: getMSG : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber+ "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },





    getMSGHref : function (szUser, szHierarchy, szUID, szHref)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - getMSGHref - Start");
            this.m_Log.Write("nsIMAPFolder.js - getMSGHref - " + szUser + " " + szHierarchy + " " + szUID);
            var bResult = false;

            var szSQL ="SELECT  messages.href ";
            szSQL   += "FROM folders, imap_accounts, messages "
            szSQL   += "WHERE  folders.account_id = imap_accounts.id AND " +
                              "messages.account_id =  imap_accounts.id AND " +
                              "imap_accounts.account_name LIKE :user AND " +
                              "folders.id = messages.folder_id AND " +
                              "folders.folder_hierarchy LIKE :hierarchy AND  " +
                              "messages.session = :session AND " +
                              "messages.id= :uid "
            szSQL   += "LIMIT 1"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser;
            statement.params.hierarchy = szHierarchy;
            statement.params.session = this.m_iSession;
            statement.params.uid = szUID;

            try
            {
                while (statement.executeStep())
                {
                   szHref.value = statement.row["href"];
                   bResult = true;
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsIMAPFolder : getMSGHref - DB Reset "+ this.m_dbConn.lastErrorString);
            }

            this.m_Log.Write("nsIMAPFolder.js - getMSGHref - END " +bResult);
            return bResult;
        }
        catch(err)
        {
             this.m_Log.DebugDump("nsIMAPFolder.js: getMSGHref : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber+ "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },





    getMSGStatus : function (szUser, szHierarchy, szUID, szHref, bRead, bDelete, iSeqNum)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - getMSGStatus - Start");
            this.m_Log.Write("nsIMAPFolder.js - getMSGStatus - " + szUser + " " + szHierarchy + " " + szUID);
            var bResult = false;

            var szSQL ="SELECT  messages.href," +
                               "messages.read, " +
                               "messages.deleted, " +
                               "(  SELECT COUNT(*) " +
                               "   FROM messages, folders, imap_accounts " +
                               "   WHERE folders.account_id = imap_accounts.id AND " +
                               "         messages.account_id = imap_accounts.id AND " +
                               "         imap_accounts.account_name LIKE :user AND " +
                               "         messages.folder_id = folders.id AND " +
                               "         folders.folder_hierarchy LIKE :hierarchy AND " +
                               "         messages.session = :session AND " +
                               "         messages.id <= :uid" +
                               ") AS sequence_number "
            szSQL   += "FROM folders, imap_accounts, messages "
            szSQL   += "WHERE  folders.account_id = imap_accounts.id AND " +
                              "messages.account_id =  imap_accounts.id AND " +
                              "imap_accounts.account_name LIKE :user AND " +
                              "folders.id = messages.folder_id AND " +
                              "folders.folder_hierarchy LIKE :hierarchy AND  " +
                              "messages.session = :session AND " +
                              "messages.id= :uid "
            szSQL   += "LIMIT 1"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser;
            statement.params.hierarchy = szHierarchy;
            statement.params.session = this.m_iSession;
            statement.params.uid = szUID;

            try
            {
                while (statement.executeStep())
                {
                   szHref.value = statement.row["href"];
                   var szRead = statement.row["read"];
                   bRead.value = (szRead.search(/true/i)!=-1) ? true : false;
                   var szDeleted = statement.row["deleted"];
                   bDelete.value = (szDeleted.search(/true/i)!=-1) ? true : false;
                   iSeqNum.value =  Number(statement.row["sequence_number"]);
                   bResult = true;
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsIMAPFolder : getMSGStatus - DB Reset "+ this.m_dbConn.lastErrorString);
            }

            this.m_Log.Write("nsIMAPFolder.js - getMSGStatus - END " +bResult);
            return bResult;
        }
        catch(err)
        {
             this.m_Log.DebugDump("nsIMAPFolder.js: getMSGStatus : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber+ "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },





    setMSGSeenFlag : function(szUser, szHierarchy, szUID, bSeen)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - setMSGSeenFlag - Start");
            this.m_Log.Write("nsIMAPFolder.js - setMSGSeenFlag - " + szUser + " " + szHierarchy + " " + szUID + " " + bSeen);

            var szSQL = "UPDATE messages ";
            szSQL    += "SET read = :seen "
            szSQL    += "WHERE id = ( SELECT messages.id " +
                                     "FROM messages, folders, imap_accounts " +
                                     "WHERE imap_accounts.account_name LIKE :user AND " +
                                     "      imap_accounts.id = folders.account_id  AND " +
                                     "      messages.account_id = imap_accounts.id AND " +
                                     "      messages.folder_id = folders.id AND " +
                                     "      folders.folder_hierarchy  = :hierarchy  AND " +
                                     "      messages.id = :uid" +
                                    ");"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser.toLowerCase();
            statement.params.hierarchy = szHierarchy;
            statement.params.uid = szUID;
            statement.params.seen = bSeen;
            statement.execute();

            this.m_Log.Write("nsIMAPFolder.js - setMSGSeenFlag - END ");
            return true;
        }
        catch(err)
        {
             this.m_Log.DebugDump("nsIMAPFolder.js: setMSGSeenFlag : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber+ "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    setMSGDeleteFlag : function (szUser, szHierarchy, szUID, bDelete)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - setMSGDeleteFlag - Start");
            this.m_Log.Write("nsIMAPFolder.js - setMSGDeleteFlag - " + szUser + " " + szHierarchy + " " + szUID + " " + bDelete);

            var szSQL = "UPDATE messages ";
            szSQL    += "SET deleted = :deleted "
            szSQL    += "WHERE id = ( SELECT messages.id " +
                                     "FROM messages, folders, imap_accounts " +
                                     "WHERE imap_accounts.account_name LIKE :user AND " +
                                     "      imap_accounts.id = folders.account_id  AND " +
                                     "      messages.account_id = imap_accounts.id AND " +
                                     "      messages.folder_id = folders.id AND " +
                                     "      folders.folder_hierarchy  = :hierarchy  AND " +
                                     "      messages.id = :uid" +
                                    ");"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser.toLowerCase();
            statement.params.hierarchy = szHierarchy;
            statement.params.uid = szUID;
            statement.params.deleted = bDelete;
            statement.execute();


            this.m_Log.Write("nsIMAPFolder.js - setMSGDeleteFlag - END ");
            return true;
        }
        catch(err)
        {
             this.m_Log.DebugDump("nsIMAPFolder.js: setMSGDeleteFlag : Exception : "
                                          + err.name
                                          + ".\nError message: "
                                          + err.message + "\n"
                                          + err.lineNumber+ "\n" +
                                          this.m_dbConn.lastErrorString);
            return false;
        }
    },




    deleteMSG : function (szUser, szHierarchy)
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - deleteMSGs - START ");
            this.m_Log.Write("nsIMAPFolder.js - deleteMSGs - " + szUser + " " + szHierarchy );

            var szSQL = "DELETE FROM messages ";
            szSQL   +=  "WHERE account_id = (SELECT id FROM imap_accounts WHERE account_name LIKE :user) AND " +
                              "folder_id = (SELECT id FROM folders WHERE folder_hierarchy LIKE :hierarchy) AND " +
                              "deleted = \"true\"";

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser;
            statement.params.hierarchy = szHierarchy;
            statement.execute();

            this.m_Log.Write("nsIMAPFolder.js - deleteMSGs - END ");
            return true;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: deleteMSGs : Exception : "
                              + err.name
                              + ".\nError message: "
                              + err.message + "\n"
                              + err.lineNumber+ "\n" +
                              this.m_dbConn.lastErrorString);
            return false;
        }
    },



   lastMsgListUpdate : function (szUser, szHierarchy)
   {
         try
        {
            this.m_Log.Write("nsIMAPFolder.js - lastMsgListUpdate - START ");
            this.m_Log.Write("nsIMAPFolder.js - lastMsgListUpdate - " + szUser + " " + szHierarchy);

            var iDate = 0;
            var szSQL = "SELECT last_folder_update.date ";
            szSQL    += "FROM last_folder_update, imap_accounts, folders "
            szSQL    += "WHERE last_folder_update.account_id = imap_accounts.id AND " +
                              "imap_accounts.id = folders.account_id AND " +
                              "imap_accounts.account_name LIKE :user AND " +
                              "folders.id = last_folder_update.folder_id AND " +
                              "folders.folder_hierarchy LIKE :hierarchy AND " +
                              "last_folder_update.session = :session"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser;
            statement.params.hierarchy = szHierarchy;
            statement.params.session = this.m_iSession;

            try
            {
                while (statement.executeStep())
                {
                   var dbDate = statement.row["date"];
                   this.m_Log.Write("nsIMAPFolder.js : dbDate - "  +dbDate);

                   var aDateTime = dbDate.split(/\s/);
                   this.m_Log.Write("nsIMAPFolder.js : aDateTime - " +aDateTime);

                   var aDate = aDateTime[0].split(/-/);
                   this.m_Log.Write("nsIMAPFolder.js : aDate - " +aDate);

                   var aTime = aDateTime[1].split(/:/);
                   this.m_Log.Write("nsIMAPFolder.js : aTime - " +aTime);

                   var oDate = new Date ();
                   oDate.setUTCFullYear(aDate[0]);
                   oDate.setUTCMonth(aDate[1]-1);
                   oDate.setUTCDate(aDate[2]);
                   oDate.setUTCHours(aTime[0]);
                   oDate.setUTCMinutes(aTime[1]);
                   oDate.setUTCSeconds(aTime[2]);

                   iDate = Date.parse(oDate);
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsIMAPFolder : lastMsgListUpdate - DB Reset "+ this.m_dbConn.lastErrorString);
            }

            this.m_Log.Write("nsIMAPFolder.js - lastMsgListUpdate - END " +iDate);
            return iDate;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: lastMsgListUpdate : Exception : "
                              + err.name
                              + ".\nError message: "
                              + err.message + "\n"
                              + err.lineNumber+ "\n" +
                              this.m_dbConn.lastErrorString);
            return 0;
        }
   },



   lastFolderListUpdate :function (szUser)
   {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - lastFolderListUpdate - START ");
            this.m_Log.Write("nsIMAPFolder.js - lastFolderListUpdate - " + szUser);

            var iDate = 0;
            var szSQL = "SELECT last_user_update.date ";
            szSQL    += "FROM last_user_update, imap_accounts "
            szSQL    += "WHERE last_user_update.account_id = imap_accounts.id AND " +
                              "imap_accounts.account_name LIKE :user AND " +
                              "last_user_update.session = :session"

            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.user = szUser;
            statement.params.session = this.m_iSession;

            try
            {
                while (statement.executeStep())
                {
                   var dbDate = statement.row["date"];
                   this.m_Log.Write("nsIMAPFolder.js : dbDate - "  +dbDate);

                   var aDateTime = dbDate.split(/\s/);
                   this.m_Log.Write("nsIMAPFolder.js : aDateTime - " +aDateTime);

                   var aDate = aDateTime[0].split(/-/);
                   this.m_Log.Write("nsIMAPFolder.js : aDate - " +aDate);

                   var aTime = aDateTime[1].split(/:/);
                   this.m_Log.Write("nsIMAPFolder.js : aTime - " +aTime);

                   var oDate = new Date ();
                   oDate.setUTCFullYear(aDate[0]);
                   oDate.setUTCMonth(aDate[1]-1);
                   oDate.setUTCDate(aDate[2]);
                   oDate.setUTCHours(aTime[0]);
                   oDate.setUTCMinutes(aTime[1]);
                   oDate.setUTCSeconds(aTime[2]);

                   iDate = Date.parse(oDate);
                }
            }
            finally
            {
                statement.reset();
                this.m_Log.Write("nsIMAPFolder : lastFolderListUpdate - DB Reset "+ this.m_dbConn.lastErrorString);
            }

            this.m_Log.Write("nsIMAPFolder.js - lastFolderListUpdate - END " +iDate);
            return iDate;
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: lastFolderListUpdate : Exception : "
                              + err.name
                              + ".\nError message: "
                              + err.message + "\n"
                              + err.lineNumber+ "\n" +
                              this.m_dbConn.lastErrorString);
            return 0;
        }
   },




    cleanDB : function ()
    {
        try
        {
            this.m_Log.Write("nsIMAPFolder.js - cleanDB - START ");

            //delete old messages
            var szSQL = "DELETE FROM messages WHERE session <= :session"
            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.session = this.m_iSession - 50;
            statement.execute();


            //delete old folders
            var szSQL = "DELETE FROM folders WHERE session <= :session"
            var statement = this.m_dbConn.createStatement(szSQL);
            statement.params.session = this.m_iSession - 100;
            statement.execute();

            this.m_Log.Write("nsIMAPFolder.js - cleanDB - END ");
        }
        catch(err)
        {
            this.m_Log.DebugDump("nsIMAPFolder.js: lastFolderListUpdate : Exception : "
                                  + err.name
                                  + ".\nError message: "
                                  + err.message + "\n"
                                  + err.lineNumber+ "\n" +
                                  this.m_dbConn.lastErrorString);
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
                                          "IMAP Folders");

                this.m_Log.Write("nsIMAPFolder.js - profile-after-change");
                this.loadDataBase();
            break;

            case "quit-application":
                this.m_Log.Write("nsIMAPFolder.js - quit-application ");
                this.cleanDB();
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
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsIMAPFolders]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsIMAPFolders]);
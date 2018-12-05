const kHotmailConstants = true;

const patternHotmailLoginURL = /urlPost:'(.*?)'/i;
const patternHotmailSRBlob = /srf_sRBlob=['|"](.*?)["|']/i;
const patternHotmailSFT =/"PPFT".*?value=["|'](.*?)["|']/i;
const patternHotmailJavaRefresh = /location\.replace\("(.*?)"\)/i;

const patternHotmailLoginForm = /<form.*?name="fmHF".*?>[\S\s]*?<\/form>/i;
const patternHotmailForm = /<form[\S\s]*?>[\S\s]*?<\/form>/i;
const patternHotmailAction = /<form.*?action="(.*?)".*?>/i;
const patternHotmailInput = /<input[\s\S]*?>/igm;
const patternHotmailType = /type="(.*?)"/i;
const patternHotmailName = /name="(.*?)"/i;
const patternHotmailValue = /value="(.*?)"/i;
const patternHotmailUM = /_UM="(.*?)"/;
const patternHotmailQS = /g_QS="(.*?)"/i;
const patternHotmailComposer = /onclick="G\('(.*?compose\?.*?)'\);"/i;
const patternHotmailCompForm = /<form\s+name="composeform".*?>[\S\s]*?<\/form>/igm;
const patternHotmailAttForm = /<form\s+name="doattach".*?>[\S\s]*?<\/form>/igm
const patternHotmailAD = /<form.*?name="addtoAB".*?>/igm;
const patternHotmailSpamForm = /<form.*?forcehip.srf.*>/igm;
const patternHotmailSpamImage =/<img.*?src="(.*?hip\.srf.*?)".*?name="hipImage"\/>/i;
const patternHotmailCurmbox = /curmbox=(.*?)&/;
const patternHotmailLogout = /<td><a.*?href="(.*?\/cgi-bin\/logout\?curmbox=.*?").*?>/m;
const patternHotmailMailbox = /<a href="(\/cgi-bin\/HoTMaiL.*?)".*?tabindex=121.*?class="E">/;
const patternHotmailFolderBase = /document.location = "(.*?)"\+f/;
const patternHotmailSRFolderList =/href="javascript:G\('\/cgi-bin\/folders\?'\)"(.*?)<a href="javascript:G\('\/cgi-bin\/folders\?'\)"/;
const patternHotmailFolderLinks =/<a.*?>/g;
const patternHotmailTabindex =/tabindex="(.*?)"/i;
const patternHotmailTabTitle =/title="(.*?)"/i;
const patternHotmailHMFO =/HMFO\('(.*?)'\)/;
const patternHotmailMsgTable = /MsgTable.*?>(.*?)<\/table>/m;
const patternHotmailMultPageNum = /<select name="MultPageNum" onChange="window\.location\.href='(.*?)'\+_UM\+'(.*?)'.*?>(.*?)<\/select>/;
const patternHotmailPages = /<option value="(.*?)".*?>/g;
const patternHotmailEmailURL = /<a.*?href="javascript:G\('(.*?)'\)">/;
const patternHotmailEmailLength = /len=(.*?)&/;
const patternHotmailEmailID = /msg=(.*?)&/;
const patternHotmailSRRead = /msgread=1/gi;
const patternHotmailSRFrom =/<tr[\S\s]*name="(.*?)"><td>/i;


/*********BETA**********/
const patternHotmailJSBounce = /srf_uRet="(.*?)"/i;
const patternHotmailJSRefresh = /<html><head><script.*?>.*?\.location\.replace.*?\("(.*?)"\).*?<\/script>.*?<\/html>/i;
const patternHotmailJSRefreshAlt = /<head><meta http-equiv="REFRESH".*?content=".*?URL=(.*?)">.*?<\/head><\/html>/i;
const patternHotmailJSRefreshAlt2 = /srf_uLogin.*?=.*?"(.*?)";/i;
const patternHotmailJSRefreshAlt3 = /self\.location\.href = ['|"](.*?wsignin.*?)['|"]/i;
const patternHotmailRefresh2 = /window\.location=['|"](.*?)['|"][\s\S]*?src=['|"](.*?)['|"]/i;
const patternHotmailRefresh3 = /window\.location/i;
const patternHotmailUIFrame = /id="UIFrame"/igm;
const patternHotmailBase = /base href="(.*?)"/i;

const patternHotmailSMTPForm = /<form.*?id="MasterForm".*?>[\S\s]*?<\/form>/i;
const patternHotmailLogOut = /logout/i;
const patternHotmailViewState = /__VIEWSTATE".*?value="(.*?)".*?\/>/i;
const patternHotmailInboxFolderID = / <td class=\"ManageFoldersFolderNameCol\">.*?href=\"(.*?000000000001.*?)\">.*?\/td>/i;
const patternHotmailJunkFolderID = / <td class=\"ManageFoldersFolderNameCol\">.*?href=\"(.*?000000000005.*?)\">.*?\/td>/i;
const patternHotmailFolderManager = /href="(ManageFolders.*?)"/i;
const patternHotmailFolderList = /<td class="[\S]?ManageFoldersFolderNameCol">.*?<a.*?><\/td>/img;
const patternHotmailFolderTitle = /<a.*?>(.*?)<\/a>/i;
const patternHotmailFolderURL = /<a.*?href="(.*?)">.*?<\/a>/i;
const patternHotmailFolderOption = /<option value=.*?>.*?<\/option>/ig;
const patternHotmailInboxContent = /<table.*?InboxTable[\s\S]*?<\/table>/ig;
const patternHotmailCompose = /href="(.*?EditMessageLight.*?)"/i;
const patternHotmailN = /EditMessageLight.aspx\\u003fn\\u003d(.*?)"/i;
const patternHotmailSend = /href=".*?,'(.*?SendMessageLight.*?)'.*?"/i;
const patternHotmailAddAttachment = /href=".*?,'(.*?AddAttachmentLight.*?)'.*?"/i;
const patternHotmailLastAttachment = /href=".*?,'(.*?EditMessageLight.*?)'.*?"/i;
const patternHotmailNavDiv = /<div class="[\S]?ItemListHeader[\S]*?>([\s\S]*?)<\/ul><\/div>/igm;
const patternHotmailSentOK = /smcMainContentContainer/im;
const patternHotmailMailBoxTable = /<table.*?Inbox.*?>[\s\S]*?(<tr.*?msg.*?>[\s\S]*<\/tr>)[\s\S]*?<\/tbody>[\r\n]*<\/table>/i;
const patternHotmailMailBoxTableRow = /<tr.*?>[\s\S]*?<\/tr>/igm;
const patternHotmailMailBoxTableData = /<td.*?>[\s\S]*?<\/td>/ig;
const patternHotmailEMailURL = /<td .*?><a href="(.*?)".*?>.*?<\/a><\/td>/i;
const patternHotmailMad = /mad=[\\]?"(.*?)[\\]?"/i;
const patternHotmailEmailRead = /mlUnrd/i;
const patternHotmailID = /id=[\\]?"(.*?)[\\]?"/i;
const patternHotmailEmailSender = /<td class=Fm>[<a>].*?email.*?"(.*?)[\\]?".*?[<\/a>]<\/td>/i;
const patternHotmailEmailSubject = /<td class=Sb><a.*?>(.*?)<\/a><\/td>/i;
const patternHotmailEmailDate = /<td class=Dt>(.*?)<\/td>/i;
const patternHotmailSentEMailID =/DraftID=(.*?)&/i;
const patternHotmailFolderID = /fid=(.*?)&/i;
const patternHotmailFromBeta = /<select.*?id="fromAddressDropdown".*?name="(.*?)"[\s\S]*<option value="(.*?)" selected>.*?<\/option>/im;
const patternHotmailMT = /mt=(.*?);/i;
const patternHotmailLight = /"(.*?Light.aspx.*?)"/i;
const patternHotmailLocale = /culture=(.*?)"/i;
const patternHotmailFrame = /iframe id="IMFrame"/i;
const patternHotmailAuthUser = /["]?AuthUser["]?:\s*?"(.*?)"/i;
const patternHotmailSessionID = /["]?SessionID["]?:\s*?"(.*?)"/i;
const patternHotmailNonce = /nonce.*?"(.*?)"/i;
const patternHotmailNewNonce = /newNonce.*?"(.*?)",/i
const patternHotmailMSGDate = /mdt=[\\]?"(.*?)[\\]?"/i
const patternHotmailLastMSGID = /id=[\\]?"(.*?)[\\]?"/i;
const patternHotmailLastMSGDate = /mdt=[\\]?"(.*?)[\\]?"/i;
const patternHotmailDispNone = /style=[\\]?"display:none;[\\]?"/i;
const patternHotmailNextPage = /<li.*?nextPageLink.*?>/ig;
const patternHotmailPageDir = /pnDir=[\\]?"(.*?)[\\]?"/i;
const patternHotmailMsgAnchor = /saDate="(.*?)"/i;
const patternHotmailAnchorDate = /kDate=\\"(.*?)\\"/i;
const patternHotmailMid = /pnMid=[\\]?"(.*?)[\\]?"/i;
const patternHotmailRtl = /g_isRtl = (.*?),/i;
const patternHotmailInboxLight =/href="(.*?inbox)"/i;
const patternHotmailInboxCount =/h_inboxCount/i;
const patternHotmailLocal = /"mkt":"(.*?)"/i;
const patternHotmailPgCount  = /mPgs=\\"(\d+)\\"/i;
const patternHotmailMSGcount = /mCt=\\"(\d+)\\"/i;

/**********************Outlook***/
const patternOutlookFList = /HM.ContainerData\(new HM.Folder\(".*?\}\,\[/i; 
const patternOutlookFListItems = /new HM.Folder/i;
const patternOutlookMSGBox = /(\:new HM.RollupData\(new HM.Rollup.*?\},\{\},\[)/i;
const patternOutlookEmailSender = /<span email=\\"(.*?)\\">/i;
const patternOutlookEmailSubject = /<span class=Sb><a.*?\\">(.*?)<\/a><\/span>/i;
const patternOutlookEmailDate = /<span class=Dt>(.*?)<\/span>/i
const patternOutlookEmailSent = /HM.SendMessageAndGetInboxDataResult/i;
const patternOutlookAttachReturn = /&#123;&#34;Caption&#34;&#58;/i;
const patternOutlookAttachID = /,"Id"\:(".*?"),/i;
const patternOutlookPgCur = /pCur=\\"(\d+)\\"/i;
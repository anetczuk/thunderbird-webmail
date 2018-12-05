Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/***********************  Domain Data ********************************/
function nsDomainData()
{
    this.m_szDomain = null;
    this.m_bPOP = false;
    this.m_bSMTP = false;
    this.m_bIMAP = false;
    this.m_bPOPDefault = false;
    this.m_bSMTPDefault = false;
    this.m_bIMAPDefault = false;
}

nsDomainData.prototype =
{
    classDescription: "Webmail Domain Data",
    classID:          Components.ID("{e350e6d0-9dd0-11db-b606-0800200c9a66}"),
    contractID:       "@mozilla.org/DomainData;1",

    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIDomainData]),

    get szDomain() {return this.m_szDomain;},
    set szDomain(domain) {return this.m_szDomain = domain;},

    get bPOP() {return this.m_bPOP;},
    set bPOP(pop) {return this.m_bPOP = pop;},

    get bPOPDefault() {return this.m_bPOPDefault;},
    set bPOPDefault(bDefault) {return this.m_bPOPDefault = bDefault;},

    get bSMTP() {return this.m_bSMTP;},
    set bSMTP(smtp) {return this.m_bSMTP = smtp;},

    get bSMTPDefault() {return this.m_bSMTPDefault;},
    set bSMTPDefault(bDefault) {return this.m_bSMTPDefault = bDefault;},

    get bIMAP() {return this.m_bIMAP;},
    set bIMAP(imap) {return this.m_bIMAP = imap;},

    get bIMAPDefault() {return this.m_bIMAPPDefault;},
    set bIMAPDefault(bDefault) {return this.m_bIMAPDefault = bDefault;}
};


/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsDomainData]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsDomainData]);

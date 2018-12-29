# Thunderbird WebMail
This is fork of *http://webmail.mozdev.org* CVS repository (version from November 2018). Main goal is to keep it working under Thunderbird 60. 

It might not work under older versions of Thunderbird.


## Current state

Main plugin, *web-mail*, works without problems. *owa* plugin configuration should work. Other plugins not testes.


## Development

To build plugins just call ```build.sh``` script from root main directory. Optionally it takes one argument to build single plugin, e.g. ```build.sh web-mail```

Building requires *ant* library.


To test plugin run thunderbird with following arguments: ```thunderbird --jsconsole --jsdebugger```


## References:
- http://webmail.mozdev.org/
- http://kb.mozillazine.org/Using_webmail_with_your_email_client

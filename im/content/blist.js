/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/imStatusUtils.jsm");

const events = ["buddy-authorization-request",
                "buddy-authorization-request-canceled",
                "contact-availability-changed",
                "contact-added",
                "contact-tag-added",
                "contact-tag-removed",
                "showing-ui-conversation",
                "status-changed",
                "tag-hidden",
                "tag-shown",
                "ui-conversation-hidden",
                "user-display-name-changed",
                "user-icon-changed",
                "prpl-quit"];

const showOfflineBuddiesPref = "messenger.buddies.showOffline";

var gBuddyListContextMenu = null;

function buddyListContextMenu(aXulMenu) {
  this.target  = document.popupNode;
  this.menu    = aXulMenu;
  let localName = this.target.localName;
  let hasVisibleBuddies = !!document.getElementById("buddylistbox").firstChild;

  // Don't display a context menu on the headers.
  this.shouldDisplay = localName != "label";

  this.onContact = localName == "contact";
  this.onBuddy = localName == "buddy";
  this.onGroup = localName == "group";
  this.onConv = localName == "conv";
  let hide = !(this.onContact || this.onBuddy);

  [ "context-edit-buddy-separator",
    "context-alias",
    "context-delete",
    "context-tags"
  ].forEach(function (aId) {
    document.getElementById(aId).hidden = hide;
  });

  document.getElementById("context-hide-tag").hidden = !this.onGroup;

  document.getElementById("context-visible-tags").hidden =
    !hide || this.onConv || !hasVisibleBuddies;

  let uiConv;
  if (!hide) {
    let contact =
      this.onContact ? this.target.contact : this.target.buddy.contact;
    uiConv = Services.conversations.getUIConversationByContactId(contact.id);
  }
  document.getElementById("context-openconversation").hidden = hide || uiConv;
  document.getElementById("context-show-conversation").hidden = !this.onConv && !uiConv;
  document.getElementById("context-close-conversation-separator").hidden = !this.onConv;
  document.getElementById("context-close-conversation").hidden = !this.onConv;
  document.getElementById("context-showlogs").hidden = hide && !this.onConv;

  if (this.onGroup) {
    document.getElementById("context-hide-tag").disabled =
      this.target.tag.id == -1;
  }
  else {
    let enumerator = this._getLogs();
    document.getElementById("context-showlogs").disabled =
      !enumerator || !enumerator.hasMoreElements();
  }

  document.getElementById("context-show-offline-buddies-separator").hidden =
    this.onConv || !hasVisibleBuddies;

  document.getElementById("context-show-offline-buddies").hidden =
    this.onConv;

  let detach = document.getElementById("context-detach");
  detach.hidden = !this.onBuddy;
  if (this.onBuddy)
    detach.disabled = this.target.buddy.contact.getBuddies().length == 1;

  document.getElementById("context-openconversation").disabled =
    !hide && !this.target.canOpenConversation();
}

// Prototype for buddyListContextMenu "class."
buddyListContextMenu.prototype = {
  openConversation: function blcm_openConversation() {
    if (this.onContact || this.onBuddy || this.onConv)
      this.target.openConversation();
  },
  closeConversation: function blcm_closeConversation() {
    if (this.onConv)
      this.target.closeConversation();
  },
  alias: function blcm_alias() {
    if (this.onContact)
      this.target.startAliasing();
    else if (this.onBuddy)
      this.target.contact.startAliasing();
  },
  detach: function blcm_detach() {
    if (!this.onBuddy)
      return;

    let buddy = this.target.buddy;
    buddy.contact.detachBuddy(buddy);
  },
  delete: function blcm_delete() {
    let buddy;
    if (this.onContact)
      buddy = this.target.contact.preferredBuddy;
    else if (this.onBuddy)
      buddy = this.target.buddy;
    else
      return;

    let bundle = document.getElementById("instantbirdBundle").stringBundle;
    let displayName = this.target.displayName;
    let promptTitle = bundle.formatStringFromName("contact.deletePrompt.title",
                                                  [displayName], 1);
    let userName = buddy.userName;
    if (displayName != userName)
      displayName += " (" + userName + ")";
    let proto = buddy.protocol.name; // FIXME build a list
    let promptMessage = bundle.formatStringFromName("contact.deletePrompt.message",
                                                    [displayName, proto], 2);
    let deleteButton = bundle.GetStringFromName("contact.deletePrompt.button");
    let prompts = Services.prompt;
    let flags = prompts.BUTTON_TITLE_IS_STRING * prompts.BUTTON_POS_0 +
                prompts.BUTTON_TITLE_CANCEL * prompts.BUTTON_POS_1 +
                prompts.BUTTON_POS_1_DEFAULT;
    if (prompts.confirmEx(window, promptTitle, promptMessage, flags,
                          deleteButton, null, null, null, {}))
      return;

    this.target.remove();
  },
  tagsPopupShowing: function blcm_tagsPopupShowing() {
    if (!this.onContact && !this.onBuddy)
      return;

    let popup = document.getElementById("context-tags-popup");
    let item;
    while ((item = popup.firstChild) && item.localName != "menuseparator")
      popup.removeChild(item);

    let contact = (this.onBuddy ? this.target.contact : this.target).contact;
    let tags = contact.getTags();
    let groupId =
      (this.onBuddy ? this.target.contact : this.target).group.groupId;
    let sortFunction = function (a, b) {
      [a, b] = [a.name.toLowerCase(), b.name.toLowerCase()];
      return a < b ? 1 : a > b ? -1 : 0;
    };
    Services.tags.getTags()
            .sort(sortFunction)
            .forEach(function (aTag) {
      item = document.createElement("menuitem");
      item.setAttribute("label", aTag.name);
      item.setAttribute("type", "checkbox");
      let id = aTag.id;
      item.groupId = id;
      if (tags.some(function (t) t.id == id)) {
        item.setAttribute("checked", "true");
        if (tags.length == 1)
          item.setAttribute("disabled", "true"); // can't remove the last tag.
      }
      popup.insertBefore(item, popup.firstChild);
    });
  },
  tag: function blcm_tag(aEvent) {
    let id = aEvent.originalTarget.groupId;
    if (!id)
      return;

    let tag = Services.tags.getTagById(id);
    let contact = (this.onBuddy ? this.target.contact : this.target).contact;
    if (contact.getTags().some(function (t) t.id == id))
      contact.removeTag(tag);
    else
      contact.addTag(tag);
  },
  addNewTag: function blcm_addNewTag() {
    let bundle = document.getElementById("instantbirdBundle").stringBundle;
    let title = bundle.GetStringFromName("newTagPromptTitle");
    let message = bundle.GetStringFromName("newTagPromptMessage");
    let name = {};
    if (!Services.prompt.prompt(window, title, message, name, null,
                                {value: false}) || !name.value)
      return; // the user canceled

    let contact = (this.onBuddy ? this.target.contact : this.target).contact;
    // If the tag already exists, createTag will return it, and if the
    // contact already has it, addTag will return early.
    contact.addTag(Services.tags.createTag(name.value));
  },
  _getLogs: function blcm_getLogs() {
    if (this.onContact)
      return Services.logs.getLogsForContact(this.target.contact, true);
    if (this.onBuddy)
      return Services.logs.getLogsForBuddy(this.target.buddy, true);
    if (this.onConv)
      return Services.logs.getLogsForConversation(this.target.conv, true);
    return null;
  },
  showLogs: function blcm_showLogs() {
    let enumerator = this._getLogs();
    if (!enumerator)
      return;
    window.openDialog("chrome://instantbird/content/viewlog.xul",
                      "Logs", "chrome,resizable", {logs: enumerator},
                      this.target.displayName);
  },
  hideTag: function blcm_hideTag() {
    if (!this.onGroup || this.target.tag.id == -1)
      return;

    this.target.hide();
  },
  visibleTagsPopupShowing: function blcm_visibleTagsPopupShowing() {
    if (this.onBuddy || this.onContact || this.onConv)
      return;

    let popup = document.getElementById("context-visible-tags-popup");
    let item;
    while ((item = popup.firstChild) && item.localName != "menuseparator")
      popup.removeChild(item);

    let sortFunction = function (a, b) {
      [a, b] = [a.name.toLowerCase(), b.name.toLowerCase()];
      return a < b ? 1 : a > b ? -1 : 0;
    };
    Services.tags.getTags()
            .sort(sortFunction)
            .forEach(function (aTag) {
      item = document.createElement("menuitem");
      item.setAttribute("label", aTag.name);
      item.setAttribute("type", "checkbox");
      let id = aTag.id;
      item.groupId = id;
      if (!Services.tags.isTagHidden(aTag))
        item.setAttribute("checked", "true");
      popup.insertBefore(item, popup.firstChild);
    });

    let otherContactsTag = document.getElementById("group-1");
    [ "context-other-contacts-tag-separator",
      "context-other-contacts-tag"
    ].forEach(function (aId) {
      document.getElementById(aId).hidden = !otherContactsTag;
    });
    if (otherContactsTag) {
      // This avoids having the localizable "Other Contacts" string in
      // both a .dtd and .properties file.
      document.getElementById("context-other-contacts-tag").label =
        otherContactsTag.displayName;
    }
  },
  visibleTags: function blcm_visibleTags(aEvent) {
    let id = aEvent.originalTarget.groupId;
    if (!id)
      return;
    let tags = Services.tags;
    let tag = tags.getTagById(id);
    if (tags.isTagHidden(tag))
      tags.showTag(tag);
    else
      tags.hideTag(tag);
  },
  toggleShowOfflineBuddies: function blcm_toggleShowOfflineBuddies() {
    let newValue =
      !!document.getElementById("context-show-offline-buddies")
                .getAttribute("checked");
    Services.prefs.setBoolPref(showOfflineBuddiesPref, newValue);
  }
};

var buddyList = {
  observe: function bl_observe(aSubject, aTopic, aMsg) {
    if (aTopic == "prpl-quit") {
      window.close();
      return;
    }

    if (aTopic == "nsPref:changed" && aMsg == showOfflineBuddiesPref) {
      let showOffline = Services.prefs.getBoolPref(showOfflineBuddiesPref);
      this._showOffline = showOffline;
      let item = document.getElementById("context-show-offline-buddies");
      if (showOffline)
        item.setAttribute("checked", "true");
      else
        item.removeAttribute("checked");

      Services.tags.getTags().forEach(function (aTag) {
        let elt = document.getElementById("group" + aTag.id);
        if (elt)
          elt.showOffline = showOffline;
        else if (showOffline) {
          if (Services.tags.isTagHidden(aTag))
            this.showOtherContacts();
          else
            this.displayGroup(aTag);
        }
      }, this);
      let elt = document.getElementById("group-1"); // "Other contacts"
      if (elt)
        elt.showOffline = showOffline;
      return;
    }

    if (aTopic == "status-changed") {
      this.displayCurrentStatus();
      return;
    }

    if (aTopic == "tag-hidden") {
      this.showOtherContacts();
      return;
    }

    if (aTopic == "tag-shown") {
      if (!document.getElementById("group" + aSubject.id))
        this.displayGroup(aSubject);
      return;
    }

    if (aTopic == "user-icon-changed") {
      this.displayUserIcon();
      return;
    }

    if (aTopic == "user-display-name-changed") {
      this.displayUserDisplayName();
      return;
    }

    if (aTopic == "ui-conversation-hidden") {
      let convElt = document.createElement("conv");
      let name = aSubject.title.toLowerCase();
      let ref = this.convBox.firstChild;
      while (ref &&
             ref.displayName.toLowerCase().localeCompare(name) < 0)
        ref = ref.nextSibling;
      this.convBox.insertBefore(convElt, ref);
      convElt.build(aSubject);
      this.convBox._updateListConvCount();
      return;
    }
    if (aTopic == "showing-ui-conversation") {
      if (this.convBox.listedConvs.hasOwnProperty(aSubject.id))
        this.convBox.listedConvs[aSubject.id].removeNode();
      return;
    }

    if (aTopic == "buddy-authorization-request") {
      aSubject.QueryInterface(Ci.prplIBuddyRequest);
      let bundle = document.getElementById("instantbirdBundle").stringBundle;
      let label = bundle.formatStringFromName("buddy.authRequest.label",
                                              [aSubject.userName], 1);
      let value =
        "buddy-auth-request-" + aSubject.account.id + aSubject.userName;
      let acceptButton = {
        accessKey: bundle.GetStringFromName("buddy.authRequest.allow.accesskey"),
        label: bundle.GetStringFromName("buddy.authRequest.allow.label"),
        callback: function() { aSubject.grant(); }
      };
      let denyButton = {
        accessKey: bundle.GetStringFromName("buddy.authRequest.deny.accesskey"),
        label: bundle.GetStringFromName("buddy.authRequest.deny.label"),
        callback: function() { aSubject.deny(); }
      };
      let box = document.getElementById("buddyListMsg");
      box.appendNotification(label, value, null, box.PRIORITY_INFO_HIGH,
                            [acceptButton, denyButton]);
      window.getAttention();
      return;
    }
    if (aTopic == "buddy-authorization-request-canceled") {
      aSubject.QueryInterface(Ci.prplIBuddyRequest);
      let value =
        "buddy-auth-request-" + aSubject.account.id + aSubject.userName;
      let notification =
        document.getElementById("buddyListMsg")
                .getNotificationWithValue(value);
      if (notification)
        notification.close();
      return;
    }

    // aSubject is an imIContact
    if (aSubject.online || this._showOffline) {
      aSubject.getTags().forEach(function (aTag) {
        if (Services.tags.isTagHidden(aTag))
          this.showOtherContacts();
        else if (!document.getElementById("group" + aTag.id))
          this.displayGroup(aTag);
      }, this);
    }
  },

  displayUserIcon: function bl_displayUserIcon() {
    let icon = Services.core.globalUserStatus.getUserIcon();
    document.getElementById("userIcon").src = icon ? icon.spec : "";
  },

  displayUserDisplayName: function bl_displayUserDisplayName() {
    let displayName = Services.core.globalUserStatus.displayName;
    let elt = document.getElementById("displayName");
    if (displayName)
      elt.removeAttribute("usingDefault");
    else {
      let bundle = document.getElementById("instantbirdBundle");
      displayName = bundle.getString("displayNameEmptyText");
      elt.setAttribute("usingDefault", displayName);
    }
    elt.setAttribute("value", displayName);
  },

  displayStatusType: function bl_displayStatusType(aStatusType) {
    document.getElementById("statusMessage")
            .setAttribute("statusType", aStatusType);
    let statusString = Status.toLabel(aStatusType);
    let statusTypeIcon = document.getElementById("statusTypeIcon");
    statusTypeIcon.setAttribute("status", aStatusType);
    statusTypeIcon.setAttribute("tooltiptext", statusString);
    return statusString;
  },

  displayCurrentStatus: function bl_displayCurrentStatus() {
    let us = Services.core.globalUserStatus;
    let status = Status.toAttribute(us.statusType);
    let message = status == "offline" ? "" : us.statusText;
    let statusString = this.displayStatusType(status);
    let statusMessage = document.getElementById("statusMessage");
    if (message)
      statusMessage.removeAttribute("usingDefault");
    else {
      statusMessage.setAttribute("usingDefault", statusString);
      message = statusString;
    }
    statusMessage.setAttribute("value", message);
    statusMessage.setAttribute("tooltiptext", message);
  },

  editStatus: function bl_editStatus(aEvent) {
    let status = aEvent.originalTarget.getAttribute("status");
    if (status == "offline") {
      let statusMessage = document.getElementById("statusMessage");
      if (statusMessage.hasAttribute("editing"))
        buddyList.finishEditStatusMessage(false);
      Services.core.globalUserStatus.setStatus(Ci.imIStatusInfo.STATUS_OFFLINE, "");
    }
    else if (status)
      this.startEditStatus(status);
  },

  startEditStatus: function bl_startEditStatus(aStatusType) {
    let currentStatusType =
      document.getElementById("statusTypeIcon").getAttribute("status");
    if (aStatusType != currentStatusType) {
      this._statusTypeBeforeEditing = currentStatusType;
      this._statusTypeEditing = aStatusType;
      this.displayStatusType(aStatusType);
    }
    this.statusMessageClick();
  },

  statusMessageClick: function bl_statusMessageClick(event) {
    let statusTypeIcon = document.getElementById("statusTypeIcon");
    if (event && event.button == 0) {
      // If the mouse clicked the statusTypeIcon with the primary
      // button, we should open the dropdown menu. (The statusMessage
      // "covers" the icon due to its enlarged focusring.)
      let box = statusTypeIcon.getBoundingClientRect();
      if (event.clientX >= box.left && event.clientX < box.right &&
          event.clientY >= box.top && event.clientY < box.bottom) {
        this.openStatusTypePopup();
        return;
      }
    }
    let statusType = statusTypeIcon.getAttribute("status");
    if (statusType == "offline")
      return;

    let elt = document.getElementById("statusMessage");
    if (!elt.hasAttribute("editing")) {
      elt.setAttribute("editing", "true");
      elt.removeAttribute("role");
      elt.removeAttribute("aria-haspopup");
      elt.addEventListener("blur", this.statusMessageBlur);
      if (elt.hasAttribute("usingDefault")) {
        if ("_statusTypeBeforeEditing" in this &&
            this._statusTypeBeforeEditing == "offline")
          elt.setAttribute("value", Services.core.globalUserStatus.statusText);
        else
          elt.removeAttribute("value");
      }
      if (!("TextboxSpellChecker" in window))
        Components.utils.import("resource:///modules/imTextboxUtils.jsm");
      TextboxSpellChecker.registerTextbox(elt);
      // force binding attachment by forcing layout
      elt.getBoundingClientRect();
      elt.select();
    }

    this.statusMessageRefreshTimer();
  },

  statusMessageRefreshTimer: function bl_statusMessageRefreshTimer() {
    const timeBeforeAutoValidate = 20 * 1000;
    if ("_stopEditStatusTimeout" in this)
      clearTimeout(this._stopEditStatusTimeout);
    this._stopEditStatusTimeout = setTimeout(this.finishEditStatusMessage,
                                             timeBeforeAutoValidate, true);
  },

  statusMessageBlur: function bl_statusMessageBlur(aEvent) {
    if (aEvent.originalTarget == document.getElementById("statusMessage").inputField)
      buddyList.finishEditStatusMessage(true);
  },

  statusMessageKeyPress: function bl_statusMessageKeyPress(aEvent) {
    let editing = document.getElementById("statusMessage").hasAttribute("editing");
    if (!editing) {
      switch (aEvent.keyCode) {
        case aEvent.DOM_VK_DOWN:
          buddyList.openStatusTypePopup();
          aEvent.preventDefault();
          return;

        case aEvent.DOM_VK_TAB:
          break;

        default:
          if (aEvent.charCode == aEvent.DOM_VK_SPACE)
            buddyList.statusMessageClick();
          return;
      }
    }
    switch (aEvent.keyCode) {
      case aEvent.DOM_VK_RETURN:
      case aEvent.DOM_VK_ENTER:
        buddyList.finishEditStatusMessage(true);
        break;

      case aEvent.DOM_VK_ESCAPE:
        buddyList.finishEditStatusMessage(false);
        break;

      case aEvent.DOM_VK_TAB:
        if (aEvent.shiftKey)
          break;
        // Ensure some item is selected when navigating by keyboard.
        if (!this.selectFirstItem("convlistbox"))
          this.selectFirstItem("buddylistbox");
        break;

      default:
        buddyList.statusMessageRefreshTimer();
    }
  },

  finishEditStatusMessage: function bl_finishEditStatusMessage(aSave) {
    clearTimeout(this._stopEditStatusTimeout);
    delete this._stopEditStatusTimeout;
    let elt = document.getElementById("statusMessage");
    if (aSave) {
      let newStatus = Ci.imIStatusInfo.STATUS_UNKNOWN;
      if ("_statusTypeEditing" in this) {
        let statusType = this._statusTypeEditing;
        if (statusType == "available")
          newStatus = Ci.imIStatusInfo.STATUS_AVAILABLE;
        else if (statusType == "unavailable")
          newStatus = Ci.imIStatusInfo.STATUS_UNAVAILABLE;
        else if (statusType == "offline")
          newStatus = Ci.imIStatusInfo.STATUS_OFFLINE;
        delete this._statusTypeBeforeEditing;
        delete this._statusTypeEditing;
      }
      // apply the new status only if it is different from the current one
      if (newStatus != Ci.imIStatusInfo.STATUS_UNKNOWN ||
          elt.value != elt.getAttribute("value"))
        Services.core.globalUserStatus.setStatus(newStatus, elt.value);
    }
    else if ("_statusTypeBeforeEditing" in this) {
      this.displayStatusType(this._statusTypeBeforeEditing);
      delete this._statusTypeBeforeEditing;
      delete this._statusTypeEditing;
    }

    if (elt.hasAttribute("usingDefault"))
      elt.setAttribute("value", elt.getAttribute("usingDefault"));
    TextboxSpellChecker.unregisterTextbox(elt);
    elt.removeAttribute("editing");
    elt.setAttribute("role", "button");
    elt.setAttribute("aria-haspopup", "true");
    elt.removeEventListener("blur", this.statusMessageBlur, false);
    if (!elt.getAttribute("focused"))
      return;
    // Force layout to remove input binding.
    elt.getBoundingClientRect();
    elt.focus();
  },

  openStatusTypePopup: function() {
    let button = document.getElementById("statusTypeIcon");
    document.getElementById("setStatusTypeMenupopup").openPopup(button, "after_start");
  },

  onStatusTypePopupShown: function() {
    // Without this, the #userIcon gains focus when the popup is opened
    // from the #statusMessage whenever the #statusMessage has been edited
    // at least once (thus changing the binding).
    document.getElementById("statusMessage").focus();
  },

  userIconKeyPress: function bl_userIconKeyPress(aEvent) {
    switch (aEvent.keyCode) {
      case aEvent.DOM_VK_RETURN:
      case aEvent.DOM_VK_ENTER:
        this.userIconClick();
        break;

      case aEvent.DOM_VK_TAB:
        if (!aEvent.shiftKey)
          break;
        // Ensure a contact is selected when navigating by keyboard.
        this.selectFirstItem("buddylistbox");
        break;

      default:
        if (aEvent.charCode == aEvent.DOM_VK_SPACE)
          this.userIconClick();
        break;
    }
  },

  userIconClick: function bl_userIconClick() {
    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    let fp = Components.classes["@mozilla.org/filepicker;1"]
                       .createInstance(nsIFilePicker);
    let bundle = document.getElementById("instantbirdBundle");
    fp.init(window, bundle.getString("userIconFilePickerTitle"),
            nsIFilePicker.modeOpen);
    fp.appendFilters(nsIFilePicker.filterImages);
    if (fp.show() == nsIFilePicker.returnOK)
      Services.core.globalUserStatus.setUserIcon(fp.file);
  },

  displayNameClick: function bl_displayNameClick() {
    let elt = document.getElementById("displayName");
    if (!elt.hasAttribute("editing")) {
      elt.setAttribute("editing", "true");
      elt.removeAttribute("role");
      if (elt.hasAttribute("usingDefault"))
        elt.removeAttribute("value");
      elt.addEventListener("blur", this.displayNameBlur);
      // force binding attachment by forcing layout
      elt.getBoundingClientRect();
      elt.select();
    }

    this.displayNameRefreshTimer();
  },

  _stopEditDisplayNameTimeout: 0,
  displayNameRefreshTimer: function bl_displayNameRefreshTimer() {
    const timeBeforeAutoValidate = 20 * 1000;
    clearTimeout(this._stopEditDisplayNameTimeout);
    this._stopEditDisplayNameTimeout =
      setTimeout(this.finishEditDisplayName, timeBeforeAutoValidate, true);
  },

  displayNameBlur: function bl_displayNameBlur(aEvent) {
    if (aEvent.originalTarget == document.getElementById("displayName").inputField)
      buddyList.finishEditDisplayName(true);
  },

  displayNameKeyPress: function bl_displayNameKeyPress(aEvent) {
    let editing = document.getElementById("displayName").hasAttribute("editing");
    if (!editing) {
      if (aEvent.charCode == aEvent.DOM_VK_SPACE)
        buddyList.displayNameClick();
      return;
    }
    switch (aEvent.keyCode) {
      case aEvent.DOM_VK_RETURN:
      case aEvent.DOM_VK_ENTER:
        buddyList.finishEditDisplayName(true);
        break;

      case aEvent.DOM_VK_ESCAPE:
        buddyList.finishEditDisplayName(false);
        break;

      default:
        buddyList.displayNameRefreshTimer();
    }
  },

  finishEditDisplayName: function bl_finishEditDisplayName(aSave) {
    clearTimeout(this._stopEditDisplayNameTimeout);
    let elt = document.getElementById("displayName");
    // Apply the new display name only if it is different from the current one.
    if (aSave && elt.value != elt.getAttribute("value"))
      Services.core.globalUserStatus.displayName = elt.value;
    else if (elt.hasAttribute("usingDefault"))
      elt.setAttribute("value", elt.getAttribute("usingDefault"));

    elt.removeAttribute("editing");
    elt.setAttribute("role", "button");
    elt.removeEventListener("blur", this.displayNameBlur, false);
    if (!elt.getAttribute("focused"))
      return;
    // Force layout to remove input binding.
    elt.getBoundingClientRect();
    elt.focus();
  },

  load: function bl_load() {
    var blistWindows = Services.wm.getEnumerator("Messenger:blist");
    while (blistWindows.hasMoreElements()) {
      var win = blistWindows.getNext();
      if (win != window) {
        win.QueryInterface(Ci.nsIDOMWindow).focus();
        window.close();
        return;
      }
    }

    // Move the window to the right of the screen on new profiles.
    let docElt = document.documentElement;
    if (!docElt.hasAttribute("height")) {
      docElt.setAttribute("height", screen.availHeight || 600);
      let width = parseInt(docElt.getAttribute("width"));
      window.moveTo(screen.availLeft + screen.availWidth - width,
                    screen.availTop);
    }

    // TODO remove this once we cleanup the way the menus are inserted
    let menubar = document.getElementById("blistMenubar");
    let statusArea = document.getElementById("statusArea");
    statusArea.parentNode.insertBefore(menubar, statusArea);

    buddyList.displayCurrentStatus();
    buddyList.displayUserDisplayName();
    buddyList.displayUserIcon();

    let prefBranch = Services.prefs;
    buddyList._showOffline = prefBranch.getBoolPref(showOfflineBuddiesPref);
    if (buddyList._showOffline) {
      document.getElementById("context-show-offline-buddies")
              .setAttribute("checked", "true");
    }

    let blistBox = document.getElementById("buddylistbox");
    blistBox.removeGroup = function(aGroupElt) {
      let index = buddyList._displayedGroups.indexOf(aGroupElt);
      if (index != -1)
        buddyList._displayedGroups.splice(index, 1);
      this.removeChild(aGroupElt);
    };
    let showOtherContacts = false;
    Services.tags.getTags().forEach(function (aTag) {
      if (Services.tags.isTagHidden(aTag))
        showOtherContacts = true;
      else
        buddyList.displayGroup(aTag);
    });
    if (showOtherContacts)
      buddyList.showOtherContacts();
    blistBox.focus();

    buddyList.convBox = document.getElementById("convlistbox");
    buddyList.convBox.listedConvs = {};
    buddyList.convBox._updateListConvCount = function() {
      let count = Object.keys(this.listedConvs).length;
      this.parentNode.setAttribute("listedConvCount", count);
    };
    buddyList.convBox.addEventListener("DOMNodeRemoved",
                                       buddyList.convBox._updateListConvCount);
    let convs = Services.conversations.getUIConversations();
    if (convs.length != 0) {
      if (!("Conversations" in window))
        Components.utils.import("resource:///modules/imWindows.jsm");
      convs.sort(function(a, b)
        a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
      for each (let conv in convs) {
        if (!Conversations.isUIConversationDisplayed(conv)) {
          let convElt = document.createElement("conv");
          buddyList.convBox.appendChild(convElt);
          convElt.build(conv);
        }
      }
      buddyList.convBox._updateListConvCount();
    }
    prefBranch.addObserver(showOfflineBuddiesPref, buddyList, false);
    for each (let event in events)
      Services.obs.addObserver(buddyList, event, false);

    this.addEventListener("unload", buddyList.unload);
  },
  _displayedGroups: [],
  _getGroupIndex: function(aName) {
    let start = 0;
    let end = this._displayedGroups.length;
    let name = aName.toLowerCase();
    while (start < end) {
      let middle = start + Math.floor((end - start) / 2);
      if (name < this._displayedGroups[middle].displayName.toLowerCase())
        end = middle;
      else
        start = middle + 1;
    }
    return end;
  },
  displayGroup: function(aTag) {
    let blistBox = document.getElementById("buddylistbox");
    let groupElt = document.createElement("group");
    let index;
    let ref = null;
    if (aTag.id != -1) {
      index = this._getGroupIndex(aTag.name);
      if (index == this._displayedGroups.length)
        ref = document.getElementById("group-1"); // 'Other Contacts'
      else
        ref = this._displayedGroups[index];
    }
    blistBox.insertBefore(groupElt, ref);

    if (this._showOffline)
      groupElt._showOffline = true;
    if (!groupElt.build(aTag))
      blistBox.removeChild(groupElt);
    else if (index !== undefined)
      this._displayedGroups.splice(index, 0, groupElt);
  },
  _showOtherContactsRequested: false,
  showOtherContacts: function bl_showOtherContacts() {
    if (this._showOtherContactsRequested)
      return;
    this._showOtherContactsRequested = true;
    setTimeout(function(aSelf) {
      if (!document.getElementById("group-1"))
        aSelf.displayGroup(Services.tags.otherContactsTag);
      aSelf._showOtherContactsRequested = false;
    }, 0, this);
  },
  onblur: function bl_onblur() {
    // Clear the buddy list selection. Contacts expand to two lines
    // when selected, but only when the buddy list has focus. This makes
    // it hard to select the right contact by clicking on an unfocused
    // contact list, as the contact will reexpand before the click is handled.
    document.getElementById("buddylistbox").clearSelection();
  },
  unload: function bl_unload() {
    for each (let event in events)
      Services.obs.removeObserver(buddyList, event);
    Services.prefs.removeObserver(showOfflineBuddiesPref, buddyList);
   },

  selectFirstItem: function (aListboxID) {
    let listbox = document.getElementById(aListboxID);
    if (!listbox.itemCount)
      return false;
    if (listbox.selectedIndex == -1)
      listbox.selectedIndex = 0;
    return true;
  },

  // Handle key pressing
  keyPress: function bl_keyPress(aEvent) {
    let target = aEvent.target;
    while (target && target.localName != "richlistbox")
      target = target.parentNode;
    if (aEvent.keyCode == aEvent.DOM_VK_TAB) {
      // Ensure some item is selected when navigating by keyboard.
      if (target.id == "convlistbox" && !aEvent.shiftKey)
        this.selectFirstItem("buddylistbox");
      if (target.id == "buddylistbox" && aEvent.shiftKey)
        this.selectFirstItem("convlistbox");
      return;
    }
    var item = target.selectedItem;
    if (!item || !item.parentNode) // empty list or item no longer in the list
      return;
    item.keyPress(aEvent);
  },

  buddylistboxFocus: function() {
    let selectedItem = document.getElementById("buddylistbox").selectedItem;
    if (selectedItem) {
      // Ensure binding changes immediately to avoid the firing of a
      // spurious accessibility focus event referring to the old binding that
      // causes problems for screen readers (BIO bug 1626, BMO bug 786508)
      selectedItem.getBoundingClientRect();
    }
  }
};

this.addEventListener("load", buddyList.load);

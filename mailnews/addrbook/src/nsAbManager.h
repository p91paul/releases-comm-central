/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsAbManager_h
#define __nsAbManager_h

#include "nsIAbManager.h"
#include "nsTObserverArray.h"
#include "nsCOMPtr.h"
#include "nsICommandLineHandler.h"
#include "nsIObserver.h"
#include "nsInterfaceHashtable.h"
#include "nsIAbDirectory.h"
#include "nsIFilePicker.h"

class nsIAbLDAPAttributeMap;

class nsAbManager : public nsIAbManager,
                    public nsICommandLineHandler,
                    public nsIObserver
{

public:
	nsAbManager();

	NS_DECL_THREADSAFE_ISUPPORTS
 	NS_DECL_NSIABMANAGER
  NS_DECL_NSIOBSERVER
  NS_DECL_NSICOMMANDLINEHANDLER

  nsresult Init();

private:
	virtual ~nsAbManager();
  nsresult GetRootDirectory(nsIAbDirectory **aResult);
  nsresult ExportDirectoryToDelimitedText(nsIAbDirectory *aDirectory, const char *aDelim,
                                          uint32_t aDelimLen, nsIFile *aLocalFile, bool useUTF8);
  nsresult ExportDirectoryToVCard(nsIAbDirectory *aDirectory, nsIFile *aLocalFile);
  nsresult ExportDirectoryToLDIF(nsIAbDirectory *aDirectory, nsIFile *aLocalFile);
  nsresult AppendLDIFForMailList(nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult);
  nsresult AppendDNForCard(const char *aProperty, nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult);
  nsresult AppendBasicLDIFForCard(nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult);
  nsresult AppendProperty(const char *aProperty, const char16_t *aValue, nsACString &aResult);
  bool IsSafeLDIFString(const char16_t *aStr);

  struct abListener {
    nsCOMPtr<nsIAbListener> mListener;
    uint32_t mNotifyFlags;

    abListener(nsIAbListener *aListener, uint32_t aNotifyFlags)
      : mListener(aListener), mNotifyFlags(aNotifyFlags) {}
    abListener(const abListener &aListener)
      : mListener(aListener.mListener), mNotifyFlags(aListener.mNotifyFlags) {}
    ~abListener() {}

    int operator==(nsIAbListener* aListener) const {
      return mListener == aListener;
    }
    int operator==(const abListener &aListener) const {
      return mListener == aListener.mListener;
    }
  };

  class nsFilePickerShownCallback
    : public nsIFilePickerShownCallback
  {
    virtual ~nsFilePickerShownCallback()
    { }

  public:
    nsFilePickerShownCallback(nsAbManager* aInput,
                              nsIFilePicker* aFilePicker,
                              nsIAbDirectory *aDirectory);
    NS_DECL_ISUPPORTS

    NS_IMETHOD Done(int16_t aResult) override;

  private:
    nsCOMPtr<nsIFilePicker> mFilePicker;
    RefPtr<nsAbManager> mAbManager;
    RefPtr<nsIAbDirectory> mDirectory;
  };

  nsTObserverArray<abListener> mListeners;
  nsCOMPtr<nsIAbDirectory> mCacheTopLevelAb;
  nsInterfaceHashtable<nsCStringHashKey, nsIAbDirectory> mAbStore;
};

#endif

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsApi, SchoolSettingsData } from '../../../api/settings.api';

export const GENERIC_DEFAULT_SETTINGS: SchoolSettingsData = {
  schoolName: 'Calulut Integrated School',
  schoolShortName: 'CIS',
  logoUrl: '/school_seal.png',
  faviconUrl: '/school_seal.png',
  loginBackgroundUrl: null,
  primaryColor: '#0A192F',
  secondaryColor: '#1B3A6B',
  accentColor: '#F5A623',
  address: 'Calulut, City of San Fernando, Pampanga',
  contactEmail: 'calulut.is@deped.gov.ph',
  contactNumber: '(045) 455-1234',
  loginWelcomeText: 'Education Shapes the Future',
  footerText: 'Calulut Integrated School Management System',
};

interface SchoolSettingsContextType {
  settings: SchoolSettingsData;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettings: (data: Partial<SchoolSettingsData>) => Promise<SchoolSettingsData>;
  resetSettings: () => Promise<SchoolSettingsData>;
}

const SchoolSettingsContext = createContext<SchoolSettingsContextType>({
  settings: GENERIC_DEFAULT_SETTINGS,
  isLoading: false,
  refreshSettings: async () => {},
  updateSettings: async () => GENERIC_DEFAULT_SETTINGS,
  resetSettings: async () => GENERIC_DEFAULT_SETTINGS,
});

export function SchoolSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SchoolSettingsData>(GENERIC_DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Apply CSS variables, browser tab title, and favicon dynamically
  const applyDOMBranding = useCallback((data: SchoolSettingsData) => {
    if (typeof document === 'undefined') return;

    // 1. Dynamic CSS variables on root
    const root = document.documentElement;
    if (data.primaryColor) root.style.setProperty('--school-primary', data.primaryColor);
    if (data.secondaryColor) root.style.setProperty('--school-secondary', data.secondaryColor);
    if (data.accentColor) root.style.setProperty('--school-accent', data.accentColor);
    if (data.logoUrl) {
      root.style.setProperty('--school-watermark', `url('${data.logoUrl}')`);
    } else {
      root.style.setProperty('--school-watermark', 'none');
    }

    // 2. Dynamic document title (strictly white-label: uses configured name, never hardcoded fallback)
    const label = data.schoolShortName || data.schoolName;
    document.title = label ? `DigiSkwela | ${label}` : 'DigiSkwela';

    // 3. Dynamic favicon
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (data.faviconUrl) {
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = data.faviconUrl;
    } else if (link) {
      link.remove();
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const publicData = await settingsApi.getPublicSettings();
      if (publicData) {
        const merged: SchoolSettingsData = {
          ...GENERIC_DEFAULT_SETTINGS,
          ...publicData,
          logoUrl: publicData.logoUrl || '/school_seal.png',
          faviconUrl: publicData.faviconUrl || '/school_seal.png',
        };
        setSettings(merged);
        applyDOMBranding(merged);
      }
    } catch {
      // Graceful fallback: keep generic defaults on fetch failure
      applyDOMBranding(GENERIC_DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, [applyDOMBranding]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (data: Partial<SchoolSettingsData>): Promise<SchoolSettingsData> => {
    const updated = await settingsApi.updateSettings(data);
    const merged: SchoolSettingsData = {
      ...settings,
      ...updated,
      schoolName: updated.schoolName || (updated as any).school_name || settings.schoolName,
      schoolShortName: updated.schoolShortName || (updated as any).school_short_name || settings.schoolShortName,
      logoUrl: updated.logoUrl !== undefined ? updated.logoUrl : (updated as any).logo_url,
      faviconUrl: updated.faviconUrl !== undefined ? updated.faviconUrl : (updated as any).favicon_url,
      primaryColor: updated.primaryColor || (updated as any).primary_color || settings.primaryColor,
      secondaryColor: updated.secondaryColor || (updated as any).secondary_color || settings.secondaryColor,
      accentColor: updated.accentColor || (updated as any).accent_color || settings.accentColor,
    };
    setSettings(merged);
    applyDOMBranding(merged);
    return merged;
  };

  const resetSettings = async (): Promise<SchoolSettingsData> => {
    const reset = await settingsApi.resetSettings();
    const restored: SchoolSettingsData = {
      ...GENERIC_DEFAULT_SETTINGS,
      ...reset,
      schoolName: reset.schoolName || (reset as any).school_name || GENERIC_DEFAULT_SETTINGS.schoolName,
      schoolShortName: reset.schoolShortName || (reset as any).school_short_name || GENERIC_DEFAULT_SETTINGS.schoolShortName,
      logoUrl: reset.logoUrl || (reset as any).logo_url || GENERIC_DEFAULT_SETTINGS.logoUrl,
      faviconUrl: reset.faviconUrl || (reset as any).favicon_url || GENERIC_DEFAULT_SETTINGS.faviconUrl,
      loginBackgroundUrl: reset.loginBackgroundUrl !== undefined ? reset.loginBackgroundUrl : (reset as any).login_background_url ?? null,
      primaryColor: reset.primaryColor || (reset as any).primary_color || GENERIC_DEFAULT_SETTINGS.primaryColor,
      secondaryColor: reset.secondaryColor || (reset as any).secondary_color || GENERIC_DEFAULT_SETTINGS.secondaryColor,
      accentColor: reset.accentColor || (reset as any).accent_color || GENERIC_DEFAULT_SETTINGS.accentColor,
      loginWelcomeText: reset.loginWelcomeText || (reset as any).login_welcome_text || GENERIC_DEFAULT_SETTINGS.loginWelcomeText,
      footerText: reset.footerText || (reset as any).footer_text || GENERIC_DEFAULT_SETTINGS.footerText,
      address: reset.address || (reset as any).address || GENERIC_DEFAULT_SETTINGS.address,
      contactEmail: reset.contactEmail || (reset as any).contact_email || GENERIC_DEFAULT_SETTINGS.contactEmail,
      contactNumber: reset.contactNumber || (reset as any).contact_number || GENERIC_DEFAULT_SETTINGS.contactNumber,
    };
    setSettings(restored);
    applyDOMBranding(restored);
    return restored;
  };


  return (
    <SchoolSettingsContext.Provider
      value={{
        settings,
        isLoading,
        refreshSettings: fetchSettings,
        updateSettings,
        resetSettings,
      }}
    >
      {children}
    </SchoolSettingsContext.Provider>
  );
}

export function useSchoolSettings() {
  return useContext(SchoolSettingsContext);
}

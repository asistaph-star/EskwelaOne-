import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsApi, SchoolSettingsData } from '../../../api/settings.api';

export const GENERIC_DEFAULT_SETTINGS: SchoolSettingsData = {
  schoolName: '',
  schoolShortName: '',
  logoUrl: null,
  faviconUrl: null,
  loginBackgroundUrl: null,
  primaryColor: '#0A192F',
  secondaryColor: '#1B3A6B',
  accentColor: '#F5A623',
  address: null,
  contactEmail: null,
  contactNumber: null,
  loginWelcomeText: 'Education Shapes the Future',
  footerText: 'DigiSkwela · School Management System',
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
    document.title = label ? `DigiSkwela — ${label}` : 'DigiSkwela';

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
    // White-label safe reset: Preserves current institutional identity, resets visual branding only
    const merged: SchoolSettingsData = {
      ...settings,
      ...reset,
      logoUrl: reset.logoUrl !== undefined ? reset.logoUrl : ((reset as any).logo_url ?? null),
      faviconUrl: reset.faviconUrl !== undefined ? reset.faviconUrl : ((reset as any).favicon_url ?? null),
      primaryColor: reset.primaryColor || (reset as any).primary_color || '#0A192F',
      secondaryColor: reset.secondaryColor || (reset as any).secondary_color || '#1B3A6B',
      accentColor: reset.accentColor || (reset as any).accent_color || '#F5A623',
      loginWelcomeText: reset.loginWelcomeText || (reset as any).login_welcome_text || 'Education Shapes the Future',
      footerText: reset.footerText || (reset as any).footer_text || 'DigiSkwela · School Management System',
    };
    setSettings(merged);
    applyDOMBranding(merged);
    return merged;
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

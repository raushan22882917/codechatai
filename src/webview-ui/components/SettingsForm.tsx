import React, { useState, useEffect } from 'react';
import { theme } from '../theme';
import { vscode } from '../utilities/vscode';

interface SettingsFormProps {
  onSave: (settings: SettingsData) => void;
  initialSettings?: SettingsData;
}

export interface SettingsData {
  groqApiKey: string;
  defaultMode: 'chat' | 'gentestx';
  defaultLanguage: string;
}

const SettingsForm: React.FC<SettingsFormProps> = ({ onSave, initialSettings }) => {
  const [settings, setSettings] = useState<SettingsData>({
    groqApiKey: initialSettings?.groqApiKey || '',
    defaultMode: initialSettings?.defaultMode || 'chat',
    defaultLanguage: initialSettings?.defaultLanguage || 'javascript',
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      // Save settings to VS Code and Supabase
      vscode.postMessage({
        type: 'save-settings',
        settings
      });
      
      // Call the onSave callback
      onSave(settings);
      
      // Show success message
      setSaveMessage({
        text: 'Settings saved successfully!',
        type: 'success'
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage({
        text: `Error saving settings: ${error instanceof Error ? error.message : String(error)}`,
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle getting a new API key
  const handleGetApiKey = () => {
    vscode.postMessage({
      type: 'open-external-url',
      url: 'https://console.groq.com/'
    });
  };

  // Handle testing the API key
  const handleTestApiKey = () => {
    if (!settings.groqApiKey) {
      setSaveMessage({
        text: 'Please enter an API key first',
        type: 'error'
      });
      return;
    }
    
    vscode.postMessage({
      type: 'test-api-key',
      apiKey: settings.groqApiKey
    });
  };

  // Listen for messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'test-api-key-response') {
        if (message.success) {
          setSaveMessage({
            text: 'API key is valid!',
            type: 'success'
          });
        } else {
          setSaveMessage({
            text: `API key is invalid: ${message.error}`,
            type: 'error'
          });
        }
      } else if (message.type === 'settings-saved') {
        if (message.success) {
          setSaveMessage({
            text: 'Settings saved successfully!',
            type: 'success'
          });
        } else {
          setSaveMessage({
            text: `Error saving settings: ${message.error}`,
            type: 'error'
          });
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Settings</h2>
      
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Groq API Key
            <div style={styles.apiKeyContainer}>
              <input
                type={showApiKey ? 'text' : 'password'}
                name="groqApiKey"
                value={settings.groqApiKey}
                onChange={handleChange}
                placeholder="Enter your Groq API key (gsk_...)"
                style={styles.apiKeyInput}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={styles.toggleButton}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          <div style={styles.apiKeyActions}>
            <button
              type="button"
              onClick={handleGetApiKey}
              style={styles.secondaryButton}
            >
              Get API Key
            </button>
            <button
              type="button"
              onClick={handleTestApiKey}
              style={styles.secondaryButton}
              disabled={!settings.groqApiKey}
            >
              Test API Key
            </button>
          </div>
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Default Mode
            <select
              name="defaultMode"
              value={settings.defaultMode}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="chat">Chat</option>
              <option value="gentestx">GenTestx AI</option>
            </select>
          </label>
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Default Language
            <select
              name="defaultLanguage"
              value={settings.defaultLanguage}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="csharp">C#</option>
              <option value="cpp">C++</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
              <option value="php">PHP</option>
              <option value="ruby">Ruby</option>
            </select>
          </label>
        </div>
        
        {saveMessage && (
          <div style={saveMessage.type === 'success' ? styles.successMessage : styles.errorMessage}>
            {saveMessage.text}
          </div>
        )}
        
        <div style={styles.formActions}>
          <button
            type="submit"
            style={styles.saveButton}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    boxShadow: theme.shadowLight,
    marginBottom: '20px',
  },
  title: {
    color: theme.white,
    fontSize: '18px',
    marginTop: 0,
    marginBottom: '20px',
    borderBottom: `1px solid ${theme.borderLight}`,
    paddingBottom: '10px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  label: {
    color: theme.textPrimary,
    fontSize: '14px',
    fontWeight: 'bold' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  apiKeyContainer: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '8px',
  },
  apiKeyInput: {
    flex: 1,
    padding: '10px 14px',
    backgroundColor: theme.backgroundInput,
    color: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
  },
  toggleButton: {
    padding: '8px 12px',
    backgroundColor: theme.buttonSecondary,
    color: theme.white,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.buttonSecondaryHover,
    },
  },
  apiKeyActions: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '8px',
    marginTop: '8px',
  },
  select: {
    padding: '10px 14px',
    backgroundColor: theme.backgroundInput,
    color: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '16px',
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: theme.buttonPrimary,
    color: theme.white,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    boxShadow: theme.shadowLight,
    transition: 'background-color 0.2s ease, transform 0.1s ease',
    '&:hover': {
      backgroundColor: theme.buttonPrimaryHover,
    },
    '&:active': {
      transform: 'translateY(1px)',
    },
  },
  secondaryButton: {
    padding: '8px 12px',
    backgroundColor: theme.buttonSecondary,
    color: theme.white,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.buttonSecondaryHover,
    },
  },
  successMessage: {
    padding: '10px 14px',
    backgroundColor: 'rgba(40, 167, 69, 0.2)',
    color: theme.success,
    borderRadius: '6px',
    fontSize: '14px',
    border: `1px solid ${theme.success}`,
  },
  errorMessage: {
    padding: '10px 14px',
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    color: theme.error,
    borderRadius: '6px',
    fontSize: '14px',
    border: `1px solid ${theme.error}`,
  },
};

export default SettingsForm;

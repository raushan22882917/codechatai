import React, { useState } from 'react';
import { theme } from '../theme';

interface TabInterfaceProps {
  tabs: {
    id: string;
    label: string;
    content: React.ReactNode;
    icon?: string;
  }[];
  defaultTab?: string;
}

const TabInterface: React.FC<TabInterfaceProps> = ({ tabs, defaultTab }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0].id);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  return (
    <div style={styles.container}>
      <div style={styles.tabsContainer}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tabButton,
              ...(activeTab === tab.id ? styles.activeTabButton : {}),
            }}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.icon && <span style={styles.tabIcon}>{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.tabContent}>
        {tabs.find(tab => tab.id === activeTab)?.content}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: `1px solid ${theme.border}`,
    backgroundColor: theme.darkNavy,
  },
  tabButton: {
    padding: '12px 20px',
    backgroundColor: 'transparent',
    color: theme.textSecondary,
    border: 'none',
    borderBottom: `2px solid transparent`,
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    '&:hover': {
      color: theme.white,
      backgroundColor: theme.lightNavy,
    },
  },
  activeTabButton: {
    color: theme.white,
    borderBottom: `2px solid ${theme.accent}`,
    backgroundColor: theme.backgroundPrimary,
  },
  tabIcon: {
    fontSize: '16px',
  },
  tabContent: {
    flex: 1,
    overflow: 'auto',
    padding: '0',
    backgroundColor: theme.backgroundPrimary,
  },
};

export default TabInterface;

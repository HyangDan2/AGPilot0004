import React, { createContext, useContext, useState, useEffect } from 'react';
import { Child } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface ChildContextType {
  childrenList: Child[];
  activeChild: Child | null;
  isLoading: boolean;
  setActiveChildId: (id: string) => void;
  refreshChildren: () => Promise<void>;
  createChild: (data: any) => Promise<Child>;
}

const ChildContext = createContext<ChildContextType | undefined>(undefined);

export const ChildProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [activeChildId, setActiveChildIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadChildren();
    } else {
      setChildrenList([]);
      setActiveChildIdState(null);
    }
  }, [user]);

  const loadChildren = async () => {
    setIsLoading(true);
    try {
      let list = await api.getChildren();
      // If no child exists, seed a starter child profile
      if (list.length === 0) {
        const starter = await api.createChild({
          name: '우리 아가 (별이)',
          birth_date: '2026-06-15',
          sex: 'female',
          is_premature: false,
        });
        list = [starter];
      }
      setChildrenList(list);

      // Restore active child selection or pick first
      const savedId = localStorage.getItem('babycare_active_child_id');
      const found = list.find((c) => c.id === savedId);
      if (found) {
        setActiveChildIdState(found.id);
      } else if (list.length > 0) {
        setActiveChildIdState(list[0].id);
        localStorage.setItem('babycare_active_child_id', list[0].id);
      }
    } catch (e) {
      console.error('Failed to load children:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveChildId = (id: string) => {
    setActiveChildIdState(id);
    localStorage.setItem('babycare_active_child_id', id);
  };

  const refreshChildren = async () => {
    try {
      const list = await api.getChildren();
      setChildrenList(list);
      if (activeChildId && !list.some((c) => c.id === activeChildId) && list.length > 0) {
        setActiveChildId(list[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createChild = async (data: any): Promise<Child> => {
    const created = await api.createChild(data);
    await refreshChildren();
    setActiveChildId(created.id);
    return created;
  };

  const activeChild = childrenList.find((c) => c.id === activeChildId) || childrenList[0] || null;

  return (
    <ChildContext.Provider
      value={{
        childrenList,
        activeChild,
        isLoading,
        setActiveChildId,
        refreshChildren,
        createChild,
      }}
    >
      {children}
    </ChildContext.Provider>
  );
};

export const useChild = () => {
  const context = useContext(ChildContext);
  if (!context) throw new Error('useChild must be used within a ChildProvider');
  return context;
};

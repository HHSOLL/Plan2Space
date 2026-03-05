"use client";

import { create } from "zustand";
import { backendFetch } from "../backend/client";

export interface Project {
  id: string;
  owner_id?: string;
  name: string;
  description: string | null;
  thumbnail?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

type ProjectState = {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  loadProjects: () => Promise<void>;
  loadProject: (projectId: string) => Promise<Project | null>;
  createProject: (data: {
    name: string;
    description?: string | null;
    thumbnail?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<Project>;
  updateProject: (id: string, data: { name?: string; description?: string | null }) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (projectId: string | null) => void;
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await backendFetch<{ items: Project[]; total?: number; nextCursor?: string | null }>(
        "/v1/projects?limit=100"
      );
      const projects = Array.isArray(response.items) ? response.items : [];
      set((state) => ({
        projects,
        currentProject: state.currentProject
          ? projects.find((project) => project.id === state.currentProject?.id) ?? state.currentProject
          : null,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load projects"
      });
    }
  },

  loadProject: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await backendFetch<{ project: Project }>(`/v1/projects/${projectId}`);
      const project = response.project;
      set((state) => {
        const existingIndex = state.projects.findIndex((item) => item.id === project.id);
        const projects = [...state.projects];
        if (existingIndex >= 0) {
          projects[existingIndex] = project;
        } else {
          projects.unshift(project);
        }
        return {
          projects,
          currentProject: project,
          isLoading: false,
          error: null
        };
      });
      return project;
    } catch (error) {
      set({
        isLoading: false,
        currentProject: null,
        error: error instanceof Error ? error.message : "Failed to load project"
      });
      return null;
    }
  },

  createProject: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const project = await backendFetch<Project>("/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          name: payload.name,
          description: payload.description ?? null
        })
      });

      set((state) => ({
        projects: [project, ...state.projects],
        currentProject: project,
        isLoading: false,
        error: null
      }));

      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create project";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  updateProject: async (id, payload) => {
    set({ isLoading: true, error: null });
    try {
      const project = await backendFetch<Project>(`/v1/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      set((state) => ({
        projects: state.projects.map((item) => (item.id === id ? project : item)),
        currentProject: state.currentProject?.id === id ? project : state.currentProject,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to update project"
      });
    }
  },

  deleteProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await backendFetch(`/v1/projects/${id}`, { method: "DELETE" });
      set((state) => ({
        projects: state.projects.filter((project) => project.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to delete project"
      });
    }
  },

  selectProject: (projectId) => {
    if (!projectId) {
      set({ currentProject: null });
      return;
    }
    const project = get().projects.find((item) => item.id === projectId) ?? null;
    set({ currentProject: project });
  }
}));

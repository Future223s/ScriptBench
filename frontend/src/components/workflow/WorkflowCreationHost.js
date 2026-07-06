"use client";

import { createContext, useContext } from "react";

import { WorkflowCreationModal } from "./WorkflowCreationModal.js";
import { useWorkflowCreation } from "../../hooks/workflow/useWorkflowCreation.js";

const WorkflowCreationContext = createContext(null);

export function useWorkflowCreationHost() {
  return useContext(WorkflowCreationContext);
}

export function WorkflowCreationHost({ children }) {
  const workflowCreation = useWorkflowCreation();

  return (
    <WorkflowCreationContext.Provider value={workflowCreation}>
      {children}
      <WorkflowCreationModal state={workflowCreation.state} actions={workflowCreation.actions} />
    </WorkflowCreationContext.Provider>
  );
}

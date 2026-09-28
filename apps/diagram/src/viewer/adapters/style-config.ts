import { snapshot } from "../snapshot";
export const currentStyleConfig = () => snapshot.style.workspace;
export const styleConfigVersion = () => 0;
export const styleConfigIssues = () => [];
export const onStyleConfigChange = () => () => {};
export const watchStyleConfig = () => () => {};

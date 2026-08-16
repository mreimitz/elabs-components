// Presentational components — usable standalone or composed by the directive factories.
export {
  DecisionCard,
  decisionCardVariants,
  DECISION_STATUSES,
  type DecisionCardProps,
  type DecisionStatus,
} from "./decision-card";

export {
  EntityCard,
  EntityChip,
  entityChipVariants,
  ENTITY_KINDS,
  type EntityCardProps,
  type EntityChipProps,
  type EntityKind,
} from "./entity";

export {
  KnowledgeCard,
  type KnowledgeCardProps,
  type KnowledgeSourceResolved,
  type KnowledgeSourceResolver,
} from "./knowledge-card";

// Directive renderer factories — wire these into MarkdownPreview `extensions.directives`.
export {
  decisionDirective,
  entityDirective,
  knowledgeDirective,
  aiObjectDirectives,
  type AiObjectDirectivesOptions,
} from "./directives";

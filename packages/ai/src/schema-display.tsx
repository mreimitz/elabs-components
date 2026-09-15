"use client";

import { Badge } from "@elabs-ai/components-ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@elabs-ai/components-ui";
import { useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { ChevronRightIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { createContext, Fragment, useContext, useMemo } from "react";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface SchemaParameter {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  location?: "path" | "query" | "header";
}

interface SchemaProperty {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  properties?: SchemaProperty[];
  items?: SchemaProperty;
}

interface SchemaDisplayContextType {
  method: HttpMethod;
  path: string;
  description?: string;
  parameters?: SchemaParameter[];
  requestBody?: SchemaProperty[];
  responseBody?: SchemaProperty[];
}

const SchemaDisplayContext = createContext<SchemaDisplayContextType>({
  method: "GET",
  path: "",
});

const methodStyles: Record<HttpMethod, string> = {
  DELETE: "border-destructive/40 bg-destructive/10 text-destructive-text",
  GET: "border-success/40 bg-success/10 text-success-text",
  PATCH: "border-warning/40 bg-warning/10 text-warning-text",
  POST: "border-info/40 bg-info/10 text-info-text",
  PUT: "border-warning/40 bg-warning/10 text-warning-text",
};

/** Splits a `{param}` path into plain-text and parameter segments for safe rendering. */
function splitSchemaPath(path: string): Array<{ text: string; isParam: boolean }> {
  const parts: Array<{ text: string; isParam: boolean }> = [];
  const regex = /\{([^}]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(path);

  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push({ isParam: false, text: path.slice(lastIndex, match.index) });
    }
    parts.push({ isParam: true, text: match[0] });
    lastIndex = match.index + match[0].length;
    match = regex.exec(path);
  }

  if (lastIndex < path.length) {
    parts.push({ isParam: false, text: path.slice(lastIndex) });
  }

  return parts;
}

export type SchemaDisplayHeaderProps = HTMLAttributes<HTMLDivElement>;

export const SchemaDisplayHeader = ({
  className,
  children,
  ...props
}: SchemaDisplayHeaderProps) => (
  <div className={cn("flex items-center gap-3 border-b px-4 py-3", className)} {...props}>
    {children}
  </div>
);

export type SchemaDisplayMethodProps = ComponentProps<typeof Badge>;

export const SchemaDisplayMethod = ({
  className,
  children,
  ...props
}: SchemaDisplayMethodProps) => {
  const { method } = useContext(SchemaDisplayContext);

  return (
    <Badge
      className={cn("font-mono text-xs", methodStyles[method], className)}
      variant="secondary"
      {...props}
    >
      {children ?? method}
    </Badge>
  );
};

export type SchemaDisplayPathProps = HTMLAttributes<HTMLSpanElement>;

export const SchemaDisplayPath = ({ className, children, ...props }: SchemaDisplayPathProps) => {
  const { path } = useContext(SchemaDisplayContext);

  // Highlight path parameters as real elements — the path is untrusted
  // (tool/model output) and must never reach dangerouslySetInnerHTML.
  const pathNodes = useMemo<ReactNode>(
    () =>
      splitSchemaPath(path).map((part, index) =>
        part.isParam ? (
          <span className="text-info-text" key={`${part.text}-${index}`}>
            {part.text}
          </span>
        ) : (
          <Fragment key={`${part.text}-${index}`}>{part.text}</Fragment>
        ),
      ),
    [path],
  );

  return (
    <span className={cn("font-mono text-sm", className)} {...props}>
      {children ?? pathNodes}
    </span>
  );
};

export type SchemaDisplayDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const SchemaDisplayDescription = ({
  className,
  children,
  ...props
}: SchemaDisplayDescriptionProps) => {
  const { description } = useContext(SchemaDisplayContext);

  return (
    <p className={cn("border-b px-4 py-3 text-muted-foreground text-sm", className)} {...props}>
      {children ?? description}
    </p>
  );
};

export type SchemaDisplayContentProps = HTMLAttributes<HTMLDivElement>;

export const SchemaDisplayContent = ({
  className,
  children,
  ...props
}: SchemaDisplayContentProps) => (
  <div className={cn("divide-y", className)} {...props}>
    {children}
  </div>
);

export type SchemaDisplayParameterProps = HTMLAttributes<HTMLDivElement> & SchemaParameter;

export const SchemaDisplayParameter = ({
  name,
  type,
  required,
  description,
  location,
  className,
  ...props
}: SchemaDisplayParameterProps) => (
  <div className={cn("px-4 py-3 ps-10", className)} {...props}>
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm">{name}</span>
      <Badge className="text-xs" variant="outline">
        {type}
      </Badge>
      {location && (
        <Badge className="text-xs" variant="secondary">
          {location}
        </Badge>
      )}
      {required && (
        <Badge
          className="border-destructive/40 bg-destructive/10 text-destructive-text text-xs"
          variant="secondary"
        >
          required
        </Badge>
      )}
    </div>
    {description && <p className="mt-1 text-muted-foreground text-sm">{description}</p>}
  </div>
);

export type SchemaDisplayParametersProps = ComponentProps<typeof Collapsible>;

export const SchemaDisplayParameters = ({
  className,
  children,
  ...props
}: SchemaDisplayParametersProps) => {
  const { parameters } = useContext(SchemaDisplayContext);
  const { t } = useLocale();

  return (
    <Collapsible className={cn(className)} defaultOpen {...props}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-3 text-start transition-colors hover:bg-muted/50">
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <span className="font-medium text-sm">{t("ai.schemaDisplay.parameters")}</span>
        <Badge className="ms-auto text-xs" variant="secondary">
          {parameters?.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="divide-y border-t">
          {children ??
            parameters?.map((param) => <SchemaDisplayParameter key={param.name} {...param} />)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export type SchemaDisplayPropertyProps = HTMLAttributes<HTMLDivElement> &
  SchemaProperty & {
    depth?: number;
  };

export const SchemaDisplayProperty = ({
  name,
  type,
  required,
  description,
  properties,
  items,
  depth = 0,
  className,
  ...props
}: SchemaDisplayPropertyProps) => {
  const hasChildren = properties || items;
  const paddingLeft = 40 + depth * 16;

  if (hasChildren) {
    return (
      <Collapsible defaultOpen={depth < 2}>
        <CollapsibleTrigger
          className={cn(
            "group flex w-full items-center gap-2 py-3 text-start transition-colors hover:bg-muted/50",
            className,
          )}
          style={{ paddingLeft }}
        >
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
          <span className="font-mono text-sm">{name}</span>
          <Badge className="text-xs" variant="outline">
            {type}
          </Badge>
          {required && (
            <Badge
              className="border-destructive/40 bg-destructive/10 text-destructive-text text-xs"
              variant="secondary"
            >
              required
            </Badge>
          )}
        </CollapsibleTrigger>
        {description && (
          <p
            className="pb-2 text-muted-foreground text-sm"
            style={{ paddingLeft: paddingLeft + 24 }}
          >
            {description}
          </p>
        )}
        <CollapsibleContent>
          <div className="divide-y border-t">
            {properties?.map((prop) => (
              <SchemaDisplayProperty key={prop.name} {...prop} depth={depth + 1} />
            ))}
            {items && <SchemaDisplayProperty {...items} depth={depth + 1} name={`${name}[]`} />}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className={cn("py-3 pe-4", className)} style={{ paddingLeft }} {...props}>
      <div className="flex items-center gap-2">
        {/* Spacer for alignment */}
        <span className="size-4" />
        <span className="font-mono text-sm">{name}</span>
        <Badge className="text-xs" variant="outline">
          {type}
        </Badge>
        {required && (
          <Badge
            className="border-destructive/40 bg-destructive/10 text-destructive-text text-xs"
            variant="secondary"
          >
            required
          </Badge>
        )}
      </div>
      {description && <p className="mt-1 ps-6 text-muted-foreground text-sm">{description}</p>}
    </div>
  );
};

export type SchemaDisplayRequestProps = ComponentProps<typeof Collapsible>;

export const SchemaDisplayRequest = ({
  className,
  children,
  ...props
}: SchemaDisplayRequestProps) => {
  const { requestBody } = useContext(SchemaDisplayContext);

  return (
    <Collapsible className={cn(className)} defaultOpen {...props}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-3 text-start transition-colors hover:bg-muted/50">
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <span className="font-medium text-sm">Request Body</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t">
          {children ??
            requestBody?.map((prop) => (
              <SchemaDisplayProperty key={prop.name} {...prop} depth={0} />
            ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export type SchemaDisplayResponseProps = ComponentProps<typeof Collapsible>;

export const SchemaDisplayResponse = ({
  className,
  children,
  ...props
}: SchemaDisplayResponseProps) => {
  const { responseBody } = useContext(SchemaDisplayContext);
  const { t } = useLocale();

  return (
    <Collapsible className={cn(className)} defaultOpen {...props}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-3 text-start transition-colors hover:bg-muted/50">
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <span className="font-medium text-sm">{t("ai.schemaDisplay.response")}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t">
          {children ??
            responseBody?.map((prop) => (
              <SchemaDisplayProperty key={prop.name} {...prop} depth={0} />
            ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export type SchemaDisplayProps = HTMLAttributes<HTMLDivElement> & {
  method: HttpMethod;
  path: string;
  description?: string;
  parameters?: SchemaParameter[];
  requestBody?: SchemaProperty[];
  responseBody?: SchemaProperty[];
};

export const SchemaDisplay = ({
  method,
  path,
  description,
  parameters,
  requestBody,
  responseBody,
  className,
  children,
  ...props
}: SchemaDisplayProps) => {
  const contextValue = useMemo(
    () => ({
      description,
      method,
      parameters,
      path,
      requestBody,
      responseBody,
    }),
    [description, method, parameters, path, requestBody, responseBody],
  );

  return (
    <SchemaDisplayContext.Provider value={contextValue}>
      <div className={cn("overflow-hidden rounded-lg border bg-background", className)} {...props}>
        {children ?? (
          <>
            <SchemaDisplayHeader>
              <div className="flex items-center gap-3">
                <SchemaDisplayMethod />
                <SchemaDisplayPath />
              </div>
            </SchemaDisplayHeader>
            {description && <SchemaDisplayDescription />}
            <SchemaDisplayContent>
              {parameters && parameters.length > 0 && <SchemaDisplayParameters />}
              {requestBody && requestBody.length > 0 && <SchemaDisplayRequest />}
              {responseBody && responseBody.length > 0 && <SchemaDisplayResponse />}
            </SchemaDisplayContent>
          </>
        )}
      </div>
    </SchemaDisplayContext.Provider>
  );
};

export type SchemaDisplayBodyProps = HTMLAttributes<HTMLDivElement>;

export const SchemaDisplayBody = ({ className, children, ...props }: SchemaDisplayBodyProps) => (
  <div className={cn("divide-y", className)} {...props}>
    {children}
  </div>
);

export type SchemaDisplayExampleProps = HTMLAttributes<HTMLPreElement>;

export const SchemaDisplayExample = ({
  className,
  children,
  ...props
}: SchemaDisplayExampleProps) => (
  <pre
    className={cn("mx-4 mb-4 overflow-auto rounded-md bg-muted p-4 font-mono text-sm", className)}
    {...props}
  >
    {children}
  </pre>
);

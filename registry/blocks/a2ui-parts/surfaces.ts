/**
 * The surfaces an agent emits in the A2UI showcase — plain data, exactly what arrives as a
 * tool-call result. Every one validates against the merged ui + charts catalog
 * (`brand-ui a2ui validate <file>`), except `GUARDRAIL_INVALID`, which is here to be refused.
 *
 * All names, numbers and companies are fictional.
 */
import type { A2uiSurfaceSpec } from "@elabs-ai/components-ai";

export const REFUND_APPROVAL: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Refund request R-2207",
  root: {
    type: "Card",
    children: [
      {
        type: "CardHeader",
        children: [
          {
            type: "CardTitle",
            children: ["Refund request R-2207"],
          },
          {
            type: "CardDescription",
            children: ["Dana Whitfield · order 58114 · opened 12 minutes ago"],
          },
          {
            type: "CardAction",
            children: [
              {
                type: "StatusBadge",
                props: {
                  status: "awaiting-approval",
                },
              },
            ],
          },
        ],
      },
      {
        type: "CardContent",
        children: [
          {
            type: "Stack",
            props: {
              gap: "md",
            },
            children: [
              {
                type: "Descriptions",
                props: {
                  columns: 2,
                },
                children: [
                  {
                    type: "DescriptionsItem",
                    props: {
                      label: "Item",
                    },
                    children: ["Trail 40 backpack, moss"],
                  },
                  {
                    type: "DescriptionsItem",
                    props: {
                      label: "Amount",
                      numeric: true,
                    },
                    children: ["€ 189.00"],
                  },
                  {
                    type: "DescriptionsItem",
                    props: {
                      label: "Bought",
                    },
                    children: ["34 days ago"],
                  },
                  {
                    type: "DescriptionsItem",
                    props: {
                      label: "Reason",
                    },
                    children: ["Strap seam came apart on second use"],
                  },
                  {
                    type: "DescriptionsItem",
                    props: {
                      label: "Customer since",
                    },
                    children: ["2019"],
                  },
                  {
                    type: "DescriptionsItem",
                    props: {
                      label: "Lifetime value",
                      numeric: true,
                    },
                    children: ["€ 8,420"],
                  },
                ],
              },
              {
                type: "Alert",
                props: {
                  variant: "warning",
                },
                children: [
                  {
                    type: "AlertTitle",
                    children: ["Outside the 30-day window by 4 days"],
                  },
                  {
                    type: "AlertDescription",
                    children: [
                      "Policy lets a team lead approve up to 14 days late for a manufacturing defect. The photos show a seam failure, not wear.",
                    ],
                  },
                ],
              },
              {
                type: "Stack",
                props: {
                  gap: "xs",
                },
                children: [
                  {
                    type: "Label",
                    props: {
                      htmlFor: "refund-note",
                    },
                    children: ["Note to the customer (optional)"],
                  },
                  {
                    type: "Textarea",
                    props: {
                      id: "refund-note",
                      rows: 2,
                      placeholder: "Sorry about the strap — we have let the supplier know.",
                    },
                    on: {
                      change: {
                        name: "note-changed",
                        payload: {
                          id: "R-2207",
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Stack",
            props: {
              direction: "row",
              gap: "sm",
              justify: "end",
              wrap: true,
            },
            children: [
              {
                type: "Button",
                props: {
                  variant: "outline",
                },
                children: ["Decline"],
                on: {
                  click: {
                    name: "decline-refund",
                    payload: {
                      id: "R-2207",
                    },
                  },
                },
              },
              {
                type: "Button",
                props: {
                  variant: "secondary",
                },
                children: ["Offer store credit"],
                on: {
                  click: {
                    name: "offer-credit",
                    payload: {
                      id: "R-2207",
                    },
                  },
                },
              },
              {
                type: "Button",
                children: ["Approve refund"],
                on: {
                  click: {
                    name: "approve-refund",
                    payload: {
                      id: "R-2207",
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

export const REFUND_APPROVED: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Refund approved",
  root: {
    type: "Card",
    children: [
      {
        type: "CardHeader",
        children: [
          {
            type: "CardTitle",
            children: ["Refund approved"],
          },
          {
            type: "CardDescription",
            children: ["€ 189.00 back to Dana Whitfield's Visa ending 4417"],
          },
          {
            type: "CardAction",
            children: [
              {
                type: "StatusBadge",
                props: {
                  status: "complete",
                },
              },
            ],
          },
        ],
      },
      {
        type: "CardContent",
        children: [
          {
            type: "Stack",
            props: {
              gap: "md",
            },
            children: [
              {
                type: "Alert",
                props: {
                  variant: "success",
                },
                children: [
                  {
                    type: "AlertTitle",
                    children: ["Done — nothing else needs you"],
                  },
                  {
                    type: "AlertDescription",
                    children: [
                      "The defect is logged against supplier batch NB-0931, the third this month.",
                    ],
                  },
                ],
              },
              {
                type: "Timeline",
                props: {
                  items: [
                    {
                      title: "Refund issued",
                      status: "done",
                      timestamp: "now",
                      description: "€ 189.00 to the original payment method",
                    },
                    {
                      title: "Return label emailed",
                      status: "done",
                      timestamp: "now",
                    },
                    {
                      title: "Customer notified",
                      status: "active",
                      description: "Email with your note is sending",
                    },
                    {
                      title: "Money arrives",
                      status: "pending",
                      timestamp: "3–5 working days",
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Stack",
            props: {
              direction: "row",
              gap: "sm",
              justify: "end",
              wrap: true,
            },
            children: [
              {
                type: "Button",
                props: {
                  variant: "outline",
                },
                children: ["Open supplier batch"],
                on: {
                  click: {
                    name: "open-batch",
                    payload: {
                      batch: "NB-0931",
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

export const REFUND_DECLINED: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Refund declined",
  root: {
    type: "Card",
    children: [
      {
        type: "CardHeader",
        children: [
          {
            type: "CardTitle",
            children: ["Refund declined"],
          },
          {
            type: "CardDescription",
            children: ["Dana Whitfield will get the decision and the reason by email"],
          },
          {
            type: "CardAction",
            children: [
              {
                type: "StatusBadge",
                props: {
                  status: "denied",
                },
              },
            ],
          },
        ],
      },
      {
        type: "CardContent",
        children: [
          {
            type: "Stack",
            props: {
              gap: "md",
            },
            children: [
              {
                type: "Alert",
                props: {
                  variant: "info",
                },
                children: [
                  {
                    type: "AlertTitle",
                    children: ["A decline on a likely defect usually comes back"],
                  },
                  {
                    type: "AlertDescription",
                    children: [
                      "7 of the last 10 declined seam failures were reopened and refunded after escalation.",
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Stack",
            props: {
              direction: "row",
              gap: "sm",
              justify: "end",
              wrap: true,
            },
            children: [
              {
                type: "Button",
                props: {
                  variant: "outline",
                },
                children: ["Undo"],
                on: {
                  click: {
                    name: "undo-decision",
                    payload: {
                      id: "R-2207",
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

export const REFUND_CREDIT: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Store credit offered",
  root: {
    type: "Card",
    children: [
      {
        type: "CardHeader",
        children: [
          {
            type: "CardTitle",
            children: ["Store credit offered"],
          },
          {
            type: "CardDescription",
            children: ["€ 210.00 credit — the refund plus 11 % — waiting for Dana's answer"],
          },
          {
            type: "CardAction",
            children: [
              {
                type: "StatusBadge",
                props: {
                  status: "pending",
                },
              },
            ],
          },
        ],
      },
      {
        type: "CardContent",
        children: [
          {
            type: "Stack",
            props: {
              gap: "md",
            },
            children: [
              {
                type: "Progress",
                props: {
                  value: 35,
                  "aria-label": "Offer valid for 7 more days",
                },
              },
              {
                type: "Text",
                props: {
                  variant: "caption",
                  tone: "muted",
                },
                children: [
                  "The offer expires in 7 days. If she declines, the request returns to you.",
                ],
              },
            ],
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Stack",
            props: {
              direction: "row",
              gap: "sm",
              justify: "end",
              wrap: true,
            },
            children: [
              {
                type: "Button",
                props: {
                  variant: "outline",
                },
                children: ["Withdraw offer"],
                on: {
                  click: {
                    name: "undo-decision",
                    payload: {
                      id: "R-2207",
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

export const REVENUE_INSIGHT: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Q3 revenue by region",
  root: {
    type: "Stack",
    props: {
      gap: "lg",
    },
    children: [
      {
        type: "SectionHeader",
        props: {
          title: "Q3 revenue grew 6 % — all of it outside the UK",
          description: "Recurring revenue by sales region, April to September, in € thousands.",
          eyebrow: {
            type: "Badge",
            props: {
              variant: "outline",
            },
            children: ["Answer · 4 sources"],
          },
        },
      },
      {
        type: "MetricGrid",
        props: {
          columns: 4,
        },
        children: [
          {
            type: "MetricCard",
            props: {
              label: "Recurring revenue",
              value: 1123000,
              valueFormat: "currency",
              delta: "+6.1 %",
              deltaDirection: "up",
              sparkline: {
                type: "Sparkline",
                props: {
                  values: [1001, 1022, 1043, 1059, 1086, 1123],
                  variant: "line",
                  fitDomain: true,
                  label: "Recurring revenue, last six months",
                  fit: "fill",
                  height: 28,
                },
              },
              currency: "EUR",
            },
          },
          {
            type: "MetricCard",
            props: {
              label: "Net revenue retention",
              value: 1.07,
              valueFormat: "percent",
              delta: "+2 pts",
              deltaDirection: "up",
              sparkline: {
                type: "Sparkline",
                props: {
                  values: [1.03, 1.04, 1.04, 1.05, 1.06, 1.07],
                  variant: "line",
                  fitDomain: true,
                  label: "Net revenue retention, last six months",
                  fit: "fill",
                  height: 28,
                },
              },
            },
          },
          {
            type: "MetricCard",
            props: {
              label: "New customers",
              value: 148,
              valueFormat: "number",
              delta: "+19",
              deltaDirection: "up",
              sparkline: {
                type: "Sparkline",
                props: {
                  values: [101, 112, 109, 124, 129, 148],
                  variant: "line",
                  fitDomain: true,
                  label: "New customers, last six months",
                  fit: "fill",
                  height: 28,
                },
              },
            },
          },
          {
            type: "MetricCard",
            props: {
              label: "Churned revenue",
              value: 46000,
              valueFormat: "currency",
              delta: "+€ 12k",
              deltaDirection: "up",
              sparkline: {
                type: "Sparkline",
                props: {
                  values: [22, 25, 29, 31, 34, 46],
                  variant: "line",
                  fitDomain: true,
                  label: "Churned revenue, last six months",
                  fit: "fill",
                  height: 28,
                },
              },
              currency: "EUR",
              positiveIsGood: false,
            },
          },
        ],
      },
      {
        type: "Grid",
        props: {
          columns: 2,
        },
        children: [
          {
            type: "ChartCard",
            props: {
              title: "DACH and Iberia carry the growth; the UK has fallen six months running",
              description:
                "Monthly recurring revenue per region, € thousands. Click a region's line to open it.",
              source: "Billing warehouse, booked revenue",
              height: 360,
            },
            children: [
              {
                type: "AutoChart",
                props: {
                  spec: {
                    type: "line",
                    data: [
                      {
                        month: "Apr",
                        DACH: 412,
                        Nordics: 188,
                        "UK & Ireland": 305,
                        Iberia: 96,
                      },
                      {
                        month: "May",
                        DACH: 428,
                        Nordics: 192,
                        "UK & Ireland": 298,
                        Iberia: 104,
                      },
                      {
                        month: "Jun",
                        DACH: 441,
                        Nordics: 201,
                        "UK & Ireland": 290,
                        Iberia: 111,
                      },
                      {
                        month: "Jul",
                        DACH: 455,
                        Nordics: 197,
                        "UK & Ireland": 284,
                        Iberia: 123,
                      },
                      {
                        month: "Aug",
                        DACH: 470,
                        Nordics: 214,
                        "UK & Ireland": 271,
                        Iberia: 131,
                      },
                      {
                        month: "Sep",
                        DACH: 498,
                        Nordics: 226,
                        "UK & Ireland": 259,
                        Iberia: 140,
                      },
                    ],
                    x: "month",
                    xType: "category",
                    series: ["DACH", "Nordics", "UK & Ireland", "Iberia"],
                    labels: {
                      series: "end",
                    },
                    valueFormat: "number",
                  },
                },
                on: {
                  datapointClick: {
                    name: "drill-region",
                  },
                },
              },
            ],
          },
          {
            type: "ChartCard",
            props: {
              title: "Three accounts explain two thirds of the UK decline",
              description:
                "Change in monthly recurring revenue since April, € thousands, UK & Ireland accounts.",
              source: "Billing warehouse",
              height: 360,
            },
            children: [
              {
                type: "AutoChart",
                props: {
                  spec: {
                    type: "bar",
                    orientation: "horizontal",
                    data: [
                      {
                        account: "Harbour Freight Ltd",
                        change: -14.2,
                      },
                      {
                        account: "Northline Rail",
                        change: -9.8,
                      },
                      {
                        account: "Calder & Wren",
                        change: -6.1,
                      },
                      {
                        account: "Pennine Foods",
                        change: -3.4,
                      },
                      {
                        account: "Aster Mobility",
                        change: 2.2,
                      },
                      {
                        account: "Thamesway",
                        change: 4.0,
                      },
                    ],
                    x: "account",
                    series: ["change"],
                    colorBy: {
                      key: "change",
                      scale: "diverging",
                      steps: 2,
                    },
                    sort: "asc",
                  },
                },
              },
            ],
          },
        ],
      },
      {
        type: "Accordion",
        props: {
          type: "single",
          collapsible: true,
        },
        children: [
          {
            type: "AccordionItem",
            props: {
              value: "method",
            },
            children: [
              {
                type: "AccordionTrigger",
                children: ["How this was computed"],
              },
              {
                type: "AccordionContent",
                children: [
                  {
                    type: "Stack",
                    props: {
                      gap: "sm",
                    },
                    children: [
                      {
                        type: "Text",
                        props: {
                          variant: "body",
                        },
                        children: [
                          "Booked recurring revenue from the billing warehouse, converted to euros at the month-end rate. A customer counts in the region of its billing entity.",
                        ],
                      },
                      {
                        type: "Table",
                        children: [
                          {
                            type: "TableHeader",
                            children: [
                              {
                                type: "TableRow",
                                children: [
                                  {
                                    type: "TableHead",
                                    children: ["Source"],
                                  },
                                  {
                                    type: "TableHead",
                                    children: ["Rows"],
                                  },
                                  {
                                    type: "TableHead",
                                    children: ["Refreshed"],
                                  },
                                ],
                              },
                            ],
                          },
                          {
                            type: "TableBody",
                            children: [
                              {
                                type: "TableRow",
                                children: [
                                  {
                                    type: "TableCell",
                                    children: ["billing.invoices"],
                                  },
                                  {
                                    type: "TableCell",
                                    children: ["48,210"],
                                  },
                                  {
                                    type: "TableCell",
                                    children: ["today 06:00"],
                                  },
                                ],
                              },
                              {
                                type: "TableRow",
                                children: [
                                  {
                                    type: "TableCell",
                                    children: ["crm.accounts"],
                                  },
                                  {
                                    type: "TableCell",
                                    children: ["3,904"],
                                  },
                                  {
                                    type: "TableCell",
                                    children: ["today 05:30"],
                                  },
                                ],
                              },
                              {
                                type: "TableRow",
                                children: [
                                  {
                                    type: "TableCell",
                                    children: ["fx.month_end"],
                                  },
                                  {
                                    type: "TableCell",
                                    children: ["72"],
                                  },
                                  {
                                    type: "TableCell",
                                    children: ["1 September"],
                                  },
                                ],
                              },
                              {
                                type: "TableRow",
                                children: [
                                  {
                                    type: "TableCell",
                                    children: ["finance.region_map"],
                                  },
                                  {
                                    type: "TableCell",
                                    children: ["41"],
                                  },
                                  {
                                    type: "TableCell",
                                    children: ["14 August"],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "Stack",
        props: {
          direction: "row",
          gap: "sm",
          wrap: true,
        },
        children: [
          {
            type: "Button",
            props: {
              variant: "outline",
            },
            children: ["Open the UK accounts"],
            on: {
              click: {
                name: "drill-region",
                payload: {
                  region: "UK & Ireland",
                },
              },
            },
          },
          {
            type: "Button",
            props: {
              variant: "outline",
            },
            children: ["Send to the revenue channel"],
            on: {
              click: {
                name: "share-answer",
              },
            },
          },
          {
            type: "Button",
            children: ["Save as a weekly report"],
            on: {
              click: {
                name: "schedule-report",
              },
            },
          },
        ],
      },
    ],
  },
};

export const REGION_DRILL: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "UK & Ireland accounts",
  root: {
    type: "Stack",
    props: {
      gap: "md",
    },
    children: [
      {
        type: "SectionHeader",
        props: {
          title: "UK & Ireland: € 46k lower than in April",
          description: "The six accounts that moved most, with what the account team logged.",
        },
      },
      {
        type: "Table",
        children: [
          {
            type: "TableHeader",
            children: [
              {
                type: "TableRow",
                children: [
                  {
                    type: "TableHead",
                    children: ["Account"],
                  },
                  {
                    type: "TableHead",
                    children: ["MRR now"],
                  },
                  {
                    type: "TableHead",
                    children: ["Since April"],
                  },
                  {
                    type: "TableHead",
                    children: ["Signal"],
                  },
                ],
              },
            ],
          },
          {
            type: "TableBody",
            children: [
              {
                type: "TableRow",
                children: [
                  {
                    type: "TableCell",
                    children: ["Harbour Freight Ltd"],
                  },
                  {
                    type: "TableCell",
                    children: ["€ 38.4k"],
                  },
                  {
                    type: "TableCell",
                    children: [
                      {
                        type: "Badge",
                        props: {
                          variant: "destructive",
                        },
                        children: ["−€ 14.2k"],
                      },
                    ],
                  },
                  {
                    type: "TableCell",
                    children: ["Moved two depots to a competitor in June"],
                  },
                ],
              },
              {
                type: "TableRow",
                children: [
                  {
                    type: "TableCell",
                    children: ["Northline Rail"],
                  },
                  {
                    type: "TableCell",
                    children: ["€ 51.0k"],
                  },
                  {
                    type: "TableCell",
                    children: [
                      {
                        type: "Badge",
                        props: {
                          variant: "destructive",
                        },
                        children: ["−€ 9.8k"],
                      },
                    ],
                  },
                  {
                    type: "TableCell",
                    children: ["Seat reduction at renewal"],
                  },
                ],
              },
              {
                type: "TableRow",
                children: [
                  {
                    type: "TableCell",
                    children: ["Calder & Wren"],
                  },
                  {
                    type: "TableCell",
                    children: ["€ 12.7k"],
                  },
                  {
                    type: "TableCell",
                    children: [
                      {
                        type: "Badge",
                        props: {
                          variant: "warning",
                        },
                        children: ["−€ 6.1k"],
                      },
                    ],
                  },
                  {
                    type: "TableCell",
                    children: ["Paused the analytics add-on"],
                  },
                ],
              },
              {
                type: "TableRow",
                children: [
                  {
                    type: "TableCell",
                    children: ["Pennine Foods"],
                  },
                  {
                    type: "TableCell",
                    children: ["€ 22.3k"],
                  },
                  {
                    type: "TableCell",
                    children: [
                      {
                        type: "Badge",
                        props: {
                          variant: "warning",
                        },
                        children: ["−€ 3.4k"],
                      },
                    ],
                  },
                  {
                    type: "TableCell",
                    children: ["No contact since July"],
                  },
                ],
              },
              {
                type: "TableRow",
                children: [
                  {
                    type: "TableCell",
                    children: ["Aster Mobility"],
                  },
                  {
                    type: "TableCell",
                    children: ["€ 18.9k"],
                  },
                  {
                    type: "TableCell",
                    children: [
                      {
                        type: "Badge",
                        props: {
                          variant: "success",
                        },
                        children: ["+€ 2.2k"],
                      },
                    ],
                  },
                  {
                    type: "TableCell",
                    children: ["Added the Dublin hub"],
                  },
                ],
              },
              {
                type: "TableRow",
                children: [
                  {
                    type: "TableCell",
                    children: ["Thamesway"],
                  },
                  {
                    type: "TableCell",
                    children: ["€ 44.1k"],
                  },
                  {
                    type: "TableCell",
                    children: [
                      {
                        type: "Badge",
                        props: {
                          variant: "success",
                        },
                        children: ["+€ 4.0k"],
                      },
                    ],
                  },
                  {
                    type: "TableCell",
                    children: ["Upgraded to the enterprise tier"],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "Stack",
        props: {
          direction: "row",
          gap: "sm",
        },
        children: [
          {
            type: "Button",
            props: {
              variant: "outline",
            },
            children: ["Back to the overview"],
            on: {
              click: {
                name: "back-to-overview",
              },
            },
          },
          {
            type: "Button",
            children: ["Draft a save plan for the top three"],
            on: {
              click: {
                name: "draft-save-plan",
              },
            },
          },
        ],
      },
    ],
  },
};

export const INCIDENT_INTAKE: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Report an incident",
  root: {
    type: "Card",
    children: [
      {
        type: "CardHeader",
        children: [
          {
            type: "CardTitle",
            children: ["Report an incident"],
          },
          {
            type: "CardDescription",
            children: [
              "I filled in what the alert told me. Correct anything that is wrong, then send it.",
            ],
          },
          {
            type: "CardAction",
            children: [
              {
                type: "Badge",
                props: {
                  variant: "warning",
                },
                children: ["Drafted from alert #88213"],
              },
            ],
          },
        ],
      },
      {
        type: "CardContent",
        children: [
          {
            type: "Stack",
            props: {
              gap: "md",
            },
            children: [
              {
                type: "Stack",
                props: {
                  gap: "xs",
                },
                children: [
                  {
                    type: "Label",
                    props: {
                      htmlFor: "inc-title",
                    },
                    children: ["What is happening?"],
                  },
                  {
                    type: "Input",
                    props: {
                      id: "inc-title",
                      defaultValue: "Checkout returns 502 for card payments in EU",
                    },
                    on: {
                      change: {
                        name: "set-title",
                      },
                    },
                  },
                ],
              },
              {
                type: "Grid",
                props: {
                  columns: 2,
                },
                children: [
                  {
                    type: "Stack",
                    props: {
                      gap: "xs",
                    },
                    children: [
                      {
                        type: "Label",
                        props: {
                          htmlFor: "inc-sev",
                        },
                        children: ["Severity"],
                      },
                      {
                        type: "Select",
                        props: {
                          defaultValue: "sev1",
                        },
                        children: [
                          {
                            type: "SelectTrigger",
                            props: {
                              "aria-label": "Severity",
                            },
                            children: [
                              {
                                type: "SelectValue",
                                props: {
                                  placeholder: "Pick a severity",
                                },
                              },
                            ],
                          },
                          {
                            type: "SelectContent",
                            children: [
                              {
                                type: "SelectItem",
                                props: {
                                  value: "sev1",
                                },
                                children: ["SEV 1 — customers cannot pay"],
                              },
                              {
                                type: "SelectItem",
                                props: {
                                  value: "sev2",
                                },
                                children: ["SEV 2 — degraded"],
                              },
                              {
                                type: "SelectItem",
                                props: {
                                  value: "sev3",
                                },
                                children: ["SEV 3 — minor"],
                              },
                            ],
                          },
                        ],
                        on: {
                          change: {
                            name: "set-severity",
                          },
                        },
                      },
                    ],
                  },
                  {
                    type: "Stack",
                    props: {
                      gap: "xs",
                    },
                    children: [
                      {
                        type: "Label",
                        props: {
                          htmlFor: "inc-svc",
                        },
                        children: ["Service"],
                      },
                      {
                        type: "Select",
                        props: {
                          defaultValue: "payments",
                        },
                        children: [
                          {
                            type: "SelectTrigger",
                            props: {
                              "aria-label": "Service",
                            },
                            children: [
                              {
                                type: "SelectValue",
                                props: {
                                  placeholder: "Pick a service",
                                },
                              },
                            ],
                          },
                          {
                            type: "SelectContent",
                            children: [
                              {
                                type: "SelectItem",
                                props: {
                                  value: "checkout",
                                },
                                children: ["checkout-api"],
                              },
                              {
                                type: "SelectItem",
                                props: {
                                  value: "payments",
                                },
                                children: ["payments-gateway"],
                              },
                              {
                                type: "SelectItem",
                                props: {
                                  value: "ledger",
                                },
                                children: ["ledger-writer"],
                              },
                            ],
                          },
                        ],
                        on: {
                          change: {
                            name: "set-service",
                          },
                        },
                      },
                    ],
                  },
                ],
              },
              {
                type: "Stack",
                props: {
                  gap: "xs",
                },
                children: [
                  {
                    type: "Label",
                    children: ["Who is affected?"],
                  },
                  {
                    type: "RadioGroup",
                    props: {
                      defaultValue: "eu",
                      "aria-label": "Who is affected?",
                    },
                    children: [
                      {
                        type: "Stack",
                        props: {
                          direction: "row",
                          gap: "md",
                          wrap: true,
                        },
                        children: [
                          {
                            type: "Stack",
                            props: {
                              direction: "row",
                              gap: "xs",
                              align: "center",
                            },
                            children: [
                              {
                                type: "RadioGroupItem",
                                props: {
                                  value: "eu",
                                  id: "aff-eu",
                                },
                              },
                              {
                                type: "Label",
                                props: {
                                  htmlFor: "aff-eu",
                                },
                                children: ["EU customers"],
                              },
                            ],
                          },
                          {
                            type: "Stack",
                            props: {
                              direction: "row",
                              gap: "xs",
                              align: "center",
                            },
                            children: [
                              {
                                type: "RadioGroupItem",
                                props: {
                                  value: "all",
                                  id: "aff-all",
                                },
                              },
                              {
                                type: "Label",
                                props: {
                                  htmlFor: "aff-all",
                                },
                                children: ["Everyone"],
                              },
                            ],
                          },
                          {
                            type: "Stack",
                            props: {
                              direction: "row",
                              gap: "xs",
                              align: "center",
                            },
                            children: [
                              {
                                type: "RadioGroupItem",
                                props: {
                                  value: "internal",
                                  id: "aff-int",
                                },
                              },
                              {
                                type: "Label",
                                props: {
                                  htmlFor: "aff-int",
                                },
                                children: ["Internal only"],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                    on: {
                      change: {
                        name: "set-affected",
                      },
                    },
                  },
                ],
              },
              {
                type: "Stack",
                props: {
                  gap: "xs",
                },
                children: [
                  {
                    type: "Label",
                    children: ["Share of checkouts failing"],
                  },
                  {
                    type: "Slider",
                    props: {
                      defaultValue: [38],
                      min: 0,
                      max: 100,
                      step: 1,
                      "aria-label": "Share of checkouts failing, percent",
                    },
                    on: {
                      change: {
                        name: "set-failure-share",
                      },
                    },
                  },
                ],
              },
              {
                type: "Stack",
                props: {
                  direction: "row",
                  gap: "sm",
                  align: "center",
                },
                children: [
                  {
                    type: "Switch",
                    props: {
                      id: "inc-page",
                      defaultChecked: true,
                    },
                    on: {
                      change: {
                        name: "set-page-oncall",
                      },
                    },
                  },
                  {
                    type: "Label",
                    props: {
                      htmlFor: "inc-page",
                    },
                    children: ["Page the payments on-call now"],
                  },
                ],
              },
              {
                type: "Stack",
                props: {
                  direction: "row",
                  gap: "sm",
                  align: "center",
                },
                children: [
                  {
                    type: "Checkbox",
                    props: {
                      id: "inc-status",
                      defaultChecked: false,
                    },
                    on: {
                      change: {
                        name: "set-status-page",
                      },
                    },
                  },
                  {
                    type: "Label",
                    props: {
                      htmlFor: "inc-status",
                    },
                    children: ["Post to the public status page"],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Stack",
            props: {
              direction: "row",
              gap: "sm",
              justify: "end",
              wrap: true,
            },
            children: [
              {
                type: "Button",
                props: {
                  variant: "ghost",
                },
                children: ["Discard"],
                on: {
                  click: {
                    name: "discard-incident",
                  },
                },
              },
              {
                type: "Button",
                children: ["Open incident"],
                on: {
                  click: {
                    name: "open-incident",
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

export const INCIDENT_OPENED: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Incident opened",
  root: {
    type: "Card",
    children: [
      {
        type: "CardHeader",
        children: [
          {
            type: "CardTitle",
            children: ["INC-4512 is open"],
          },
          {
            type: "CardDescription",
            children: ["SEV 1 · payments-gateway · EU customers"],
          },
          {
            type: "CardAction",
            children: [
              {
                type: "StatusBadge",
                props: {
                  status: "running",
                },
              },
            ],
          },
        ],
      },
      {
        type: "CardContent",
        children: [
          {
            type: "Stack",
            props: {
              gap: "md",
            },
            children: [
              {
                type: "Timeline",
                props: {
                  items: [
                    {
                      title: "Incident opened",
                      status: "done",
                      timestamp: "14:02",
                    },
                    {
                      title: "Priya Raman paged",
                      status: "done",
                      timestamp: "14:02",
                      description: "Payments on-call, acknowledged in 40 seconds",
                    },
                    {
                      title: "War room created",
                      status: "done",
                      timestamp: "14:03",
                      description: "#inc-4512 with the last three deploys attached",
                    },
                    {
                      title: "Rollback of payments-gateway v812",
                      status: "active",
                      description: "Waiting for your go-ahead",
                    },
                    {
                      title: "Post-incident review",
                      status: "pending",
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Stack",
            props: {
              direction: "row",
              gap: "sm",
              justify: "end",
              wrap: true,
            },
            children: [
              {
                type: "Button",
                props: {
                  variant: "outline",
                },
                children: ["Hold the rollback"],
                on: {
                  click: {
                    name: "hold-rollback",
                    payload: {
                      incident: "INC-4512",
                    },
                  },
                },
              },
              {
                type: "Button",
                props: {
                  variant: "destructive",
                },
                children: ["Roll back now"],
                on: {
                  click: {
                    name: "confirm-rollback",
                    payload: {
                      incident: "INC-4512",
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

export const ROLLOUT_PLAN: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Rollout of search-ranker v3",
  root: {
    type: "Stack",
    props: {
      gap: "md",
    },
    children: [
      {
        type: "SectionHeader",
        props: {
          title: "search-ranker v3 is at 25 % — I recommend holding",
          description:
            "Latency is inside the budget, but zero-result searches doubled in the canary.",
          actions: {
            type: "StatusBadge",
            props: {
              status: "awaiting-approval",
            },
          },
        },
      },
      {
        type: "Grid",
        props: {
          columns: 3,
        },
        children: [
          {
            type: "Card",
            children: [
              {
                type: "CardHeader",
                children: [
                  {
                    type: "CardDescription",
                    children: ["Traffic on v3"],
                  },
                  {
                    type: "CardTitle",
                    children: ["25 %"],
                  },
                ],
              },
              {
                type: "CardContent",
                children: [
                  {
                    type: "Progress",
                    props: {
                      value: 25,
                      marker: 50,
                      markerLabel: "next step 50 %",
                      "aria-label": "Traffic on version 3",
                    },
                  },
                ],
              },
            ],
          },
          {
            type: "Card",
            children: [
              {
                type: "CardHeader",
                children: [
                  {
                    type: "CardDescription",
                    children: ["p95 latency vs 240 ms budget"],
                  },
                  {
                    type: "CardTitle",
                    children: ["212 ms"],
                  },
                ],
              },
              {
                type: "CardContent",
                children: [
                  {
                    type: "BulletChart",
                    props: {
                      value: 212,
                      target: 240,
                      comparative: 198,
                      min: 0,
                      max: 320,
                      bands: [160, 240, 320],
                      higherIsBetter: false,
                      size: "sm",
                      accessibleLabel:
                        "p95 latency 212 milliseconds against a 240 millisecond budget",
                    },
                  },
                ],
              },
            ],
          },
          {
            type: "Card",
            children: [
              {
                type: "CardHeader",
                children: [
                  {
                    type: "CardDescription",
                    children: ["Zero-result searches"],
                  },
                  {
                    type: "CardTitle",
                    children: ["4.8 %"],
                  },
                ],
              },
              {
                type: "CardContent",
                children: [
                  {
                    type: "Sparkline",
                    props: {
                      values: [2.2, 2.3, 2.1, 2.4, 3.9, 4.6, 4.8],
                      variant: "line",
                      target: 2.5,
                      label: "Zero-result search rate, last seven hours",
                      showLastValue: true,
                      lastValueSuffix: "%",
                      width: 180,
                      height: 36,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "Tabs",
        props: {
          defaultValue: "checks",
        },
        children: [
          {
            type: "TabsList",
            children: [
              {
                type: "TabsTrigger",
                props: {
                  value: "checks",
                },
                children: ["Checks"],
              },
              {
                type: "TabsTrigger",
                props: {
                  value: "plan",
                },
                children: ["Plan"],
              },
              {
                type: "TabsTrigger",
                props: {
                  value: "why",
                },
                children: ["Why hold?"],
              },
            ],
          },
          {
            type: "TabsContent",
            props: {
              value: "checks",
            },
            children: [
              {
                type: "Table",
                children: [
                  {
                    type: "TableHeader",
                    children: [
                      {
                        type: "TableRow",
                        children: [
                          {
                            type: "TableHead",
                            children: ["Check"],
                          },
                          {
                            type: "TableHead",
                            children: ["Result"],
                          },
                          {
                            type: "TableHead",
                            children: ["Threshold"],
                          },
                          {
                            type: "TableHead",
                            children: ["State"],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    type: "TableBody",
                    children: [
                      {
                        type: "TableRow",
                        children: [
                          {
                            type: "TableCell",
                            children: ["Error rate"],
                          },
                          {
                            type: "TableCell",
                            children: ["0.11 %"],
                          },
                          {
                            type: "TableCell",
                            children: ["< 0.5 %"],
                          },
                          {
                            type: "TableCell",
                            children: [
                              {
                                type: "StatusBadge",
                                props: {
                                  status: "complete",
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        type: "TableRow",
                        children: [
                          {
                            type: "TableCell",
                            children: ["p95 latency"],
                          },
                          {
                            type: "TableCell",
                            children: ["212 ms"],
                          },
                          {
                            type: "TableCell",
                            children: ["< 240 ms"],
                          },
                          {
                            type: "TableCell",
                            children: [
                              {
                                type: "StatusBadge",
                                props: {
                                  status: "complete",
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        type: "TableRow",
                        children: [
                          {
                            type: "TableCell",
                            children: ["Zero-result searches"],
                          },
                          {
                            type: "TableCell",
                            children: ["4.8 %"],
                          },
                          {
                            type: "TableCell",
                            children: ["< 2.5 %"],
                          },
                          {
                            type: "TableCell",
                            children: [
                              {
                                type: "StatusBadge",
                                props: {
                                  status: "failed",
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        type: "TableRow",
                        children: [
                          {
                            type: "TableCell",
                            children: ["Click-through on first result"],
                          },
                          {
                            type: "TableCell",
                            children: ["31.2 %"],
                          },
                          {
                            type: "TableCell",
                            children: ["> 30 %"],
                          },
                          {
                            type: "TableCell",
                            children: [
                              {
                                type: "StatusBadge",
                                props: {
                                  status: "complete",
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        type: "TableRow",
                        children: [
                          {
                            type: "TableCell",
                            children: ["Index freshness"],
                          },
                          {
                            type: "TableCell",
                            children: ["9 min"],
                          },
                          {
                            type: "TableCell",
                            children: ["< 15 min"],
                          },
                          {
                            type: "TableCell",
                            children: [
                              {
                                type: "StatusBadge",
                                props: {
                                  status: "complete",
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: "TabsContent",
            props: {
              value: "plan",
            },
            children: [
              {
                type: "Timeline",
                props: {
                  items: [
                    {
                      title: "1 % canary",
                      status: "done",
                      timestamp: "Mon 09:00",
                    },
                    {
                      title: "10 %",
                      status: "done",
                      timestamp: "Mon 15:00",
                    },
                    {
                      title: "25 %",
                      status: "active",
                      timestamp: "Tue 10:00",
                      description: "Holding for a decision",
                    },
                    {
                      title: "50 %",
                      status: "pending",
                    },
                    {
                      title: "100 %",
                      status: "pending",
                    },
                  ],
                },
              },
            ],
          },
          {
            type: "TabsContent",
            props: {
              value: "why",
            },
            children: [
              {
                type: "Stack",
                props: {
                  gap: "sm",
                },
                children: [
                  {
                    type: "Text",
                    children: [
                      "v3 drops the fuzzy-match fallback for queries under four characters. 71 % of the new zero-result searches are product codes such as “K2” or “M8x”.",
                    ],
                  },
                  {
                    type: "Alert",
                    props: {
                      variant: "info",
                    },
                    children: [
                      {
                        type: "AlertTitle",
                        children: ["A fix exists"],
                      },
                      {
                        type: "AlertDescription",
                        children: [
                          "PR 9114 restores the fallback for short queries and passed the offline replay an hour ago.",
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "Stack",
        props: {
          direction: "row",
          gap: "sm",
          justify: "end",
          wrap: true,
        },
        children: [
          {
            type: "Button",
            props: {
              variant: "destructive",
            },
            children: ["Roll back to v2"],
            on: {
              click: {
                name: "rollback",
                payload: {
                  service: "search-ranker",
                },
              },
            },
          },
          {
            type: "Button",
            props: {
              variant: "outline",
            },
            children: ["Continue to 50 %"],
            on: {
              click: {
                name: "continue-rollout",
                payload: {
                  service: "search-ranker",
                  to: 50,
                },
              },
            },
          },
          {
            type: "Button",
            children: ["Hold and ship PR 9114 first"],
            on: {
              click: {
                name: "hold-rollout",
                payload: {
                  service: "search-ranker",
                  pr: 9114,
                },
              },
            },
          },
        ],
      },
    ],
  },
};

export const ROLLOUT_HELD: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Rollout held",
  root: {
    type: "Card",
    children: [
      {
        type: "CardHeader",
        children: [
          {
            type: "CardTitle",
            children: ["Rollout held at 25 %"],
          },
          {
            type: "CardDescription",
            children: ["PR 9114 is queued for the 15:00 deploy train"],
          },
          {
            type: "CardAction",
            children: [
              {
                type: "StatusBadge",
                props: {
                  status: "pending",
                },
              },
            ],
          },
        ],
      },
      {
        type: "CardContent",
        children: [
          {
            type: "Timeline",
            props: {
              items: [
                {
                  title: "Traffic frozen at 25 %",
                  status: "done",
                  timestamp: "now",
                },
                {
                  title: "PR 9114 in the deploy train",
                  status: "active",
                  timestamp: "15:00",
                },
                {
                  title: "Re-run the canary checks",
                  status: "pending",
                },
                {
                  title: "Ask you again",
                  status: "pending",
                  description: "Only if every check is green",
                },
              ],
            },
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Stack",
            props: {
              direction: "row",
              gap: "sm",
              justify: "end",
              wrap: true,
            },
            children: [
              {
                type: "Button",
                props: {
                  variant: "outline",
                },
                children: ["Resume now instead"],
                on: {
                  click: {
                    name: "continue-rollout",
                    payload: {
                      service: "search-ranker",
                      to: 50,
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

export const GUARDRAIL_INVALID: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Limited-time offer",
  root: {
    type: "Stack",
    props: {
      gap: "md",
    },
    children: [
      {
        type: "Card",
        props: {
          className: "promo-banner brand-red",
          style: {
            boxShadow: "0 0 40px red",
          },
        },
        children: [
          {
            type: "CardHeader",
            children: [
              {
                type: "CardTitle",
                children: ["Limited-time offer"],
              },
            ],
          },
        ],
      },
      {
        type: "Iframe",
        props: {
          src: "https://promo.example/track",
        },
      },
      {
        type: "Button",
        props: {
          variant: "primary",
          onClick: "fetch('/api/transfer?to=me')",
        },
        children: ["Claim now"],
      },
      {
        type: "Badge",
        children: ["Hover me"],
        on: {
          hover: {
            name: "peek",
          },
        },
      },
      {
        type: "Progress",
        props: {
          value: "almost",
        },
      },
    ],
  },
};

export const GUARDRAIL_REPAIRED: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Limited-time offer",
  root: {
    type: "Card",
    children: [
      {
        type: "CardHeader",
        children: [
          {
            type: "CardTitle",
            children: ["Limited-time offer"],
          },
          {
            type: "CardDescription",
            children: ["Annual plan, 20 % off until Friday"],
          },
          {
            type: "CardAction",
            children: [
              {
                type: "Badge",
                props: {
                  variant: "info",
                },
                children: ["Ends Friday"],
              },
            ],
          },
        ],
      },
      {
        type: "CardContent",
        children: [
          {
            type: "Stack",
            props: {
              gap: "sm",
            },
            children: [
              {
                type: "Progress",
                props: {
                  value: 72,
                  "aria-label": "72 of 100 offer codes claimed",
                },
              },
              {
                type: "Text",
                props: {
                  variant: "caption",
                  tone: "muted",
                },
                children: ["72 of 100 codes claimed"],
              },
            ],
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Stack",
            props: {
              direction: "row",
              gap: "sm",
              justify: "end",
              wrap: true,
            },
            children: [
              {
                type: "Button",
                props: {
                  variant: "ghost",
                },
                children: ["Not now"],
                on: {
                  click: {
                    name: "dismiss-offer",
                  },
                },
              },
              {
                type: "Button",
                children: ["Claim the offer"],
                on: {
                  click: {
                    name: "claim-offer",
                    payload: {
                      plan: "annual",
                      discount: 0.2,
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

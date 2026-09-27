import cairosvg
NAVY="#142D4A"; BG="#0E2340"; GREEN="#009845"; BLUE="#1E4E78"; AQUA="#10CFC9"; GREY="#A9B3B6"; PURPLE="#93579C"; WHITE="#FFFFFF"
F="font-family='Inter, Helvetica, Arial, sans-serif'"
W,H=1600,900
s=[f"<svg xmlns='http://www.w3.org/2000/svg' width='{W}' height='{H}' viewBox='0 0 {W} {H}'>",
   f"<rect width='{W}' height='{H}' fill='{BG}'/>",
   f"<text x='60' y='64' {F} font-size='34' font-weight='700' fill='{WHITE}'>Lakehouse on AWS with Databricks and Snowflake</text>",
   f"<text x='60' y='96' {F} font-size='20' fill='{AQUA}'>Visual lens — Qlik marketecture style, derived from the technical diagram</text>",
   f"<text x='{W-60}' y='{H-30}' {F} font-size='12' fill='{GREY}' text-anchor='end'>mock · atlas · visual:qlik-marketecture</text>"]
def zone(x,y,w,h,label,accent):
    s.append(f"<rect x='{x}' y='{y}' width='{w}' height='{h}' rx='6' fill='{NAVY}'/>")
    s.append(f"<rect x='{x}' y='{y}' width='{w}' height='4' rx='2' fill='{accent}'/>")
    s.append(f"<text x='{x+w/2}' y='{y+26}' {F} font-size='12' letter-spacing='2' fill='{GREY}' text-anchor='middle'>{label}</text>")
def box(x,y,w,h,title,items=(),fill=BLUE,pills=(),sub=None):
    s.append(f"<rect x='{x}' y='{y}' width='{w}' height='{h}' rx='6' fill='{fill}'/>")
    s.append(f"<text x='{x+w/2}' y='{y+26}' {F} font-size='15' font-weight='700' fill='{WHITE}' text-anchor='middle'>{title}</text>")
    if sub: s.append(f"<text x='{x+w/2}' y='{y+44}' {F} font-size='11' fill='{WHITE}' opacity='0.85' text-anchor='middle'>{sub}</text>")
    for i,it in enumerate(items):
        yy=y+(58 if sub else 50)+i*24
        s.append(f"<circle cx='{x+22}' cy='{yy-4}' r='6' fill='none' stroke='{WHITE}' stroke-width='1.5'/>")
        s.append(f"<text x='{x+38}' y='{yy}' {F} font-size='13' fill='{WHITE}'>{it}</text>")
    for i,p in enumerate(pills):
        pw=len(p)*7.5+18; px=x+w-pw+8; py=y-10+i*24
        s.append(f"<rect x='{px}' y='{py}' width='{pw}' height='20' rx='10' fill='{AQUA}'/>")
        s.append(f"<text x='{px+pw/2}' y='{py+14}' {F} font-size='10' font-weight='700' fill='{WHITE}' text-anchor='middle' letter-spacing='1'>{p}</text>")
def sub_box(x,y,w,h,title):
    s.append(f"<rect x='{x}' y='{y}' width='{w}' height='{h}' rx='5' fill='none' stroke='{WHITE}' stroke-width='1.2'/>")
    s.append(f"<text x='{x+w/2}' y='{y+h/2+4}' {F} font-size='12' fill='{WHITE}' text-anchor='middle'>{title}</text>")
def arrow(pts,dashed=False,badge=None):
    d="M"+" L".join(f"{x},{y}" for x,y in pts)
    dash=" stroke-dasharray='6 5'" if dashed else ""
    s.append(f"<path d='{d}' fill='none' stroke='{WHITE}' stroke-width='1.4'{dash} marker-end='url(#ah)'/>")
    if badge:
        mx,my=pts[len(pts)//2]
        s.append(f"<rect x='{mx-18}' y='{my-11}' width='36' height='20' rx='10' fill='{GREEN}'/><text x='{mx}' y='{my+4}' {F} font-size='10' font-weight='700' fill='{WHITE}' text-anchor='middle'>{badge}</text>")
s.append(f"<defs><marker id='ah' markerWidth='8' markerHeight='8' refX='7' refY='4' orient='auto'><path d='M0,0 L8,4 L0,8 z' fill='{WHITE}'/></marker></defs>")
# control plane band
zone(60,130,1480,120,"QLIK CLOUD — CONTROL PLANE",GREEN)
box(90,160,300,70,"Qlik Cloud Analytics",fill=GREEN,sub="Customer tenant · SSO via Okta")
box(420,160,300,70,"Databricks workspace",sub="Control plane · SaaS")
s.append(f"<text x='1400' y='190' {F} font-size='12' fill='{GREY}'>Pipeline design</text><text x='1400' y='208' {F} font-size='12' fill='{WHITE}'>• Medallion, Type 2 SCD</text><text x='1400' y='226' {F} font-size='12' fill='{WHITE}'>• Direct Query to analytics</text>")
# lanes
zone(60,290,330,540,"DATA SOURCES",GREY)
zone(420,290,720,540,"CUSTOMER MANAGED ENV — AWS",PURPLE)
zone(1170,290,370,540,"TARGETS",AQUA)
box(90,340,270,120,"Streaming &amp; Events",["Kafka (Amazon MSK)"])
box(90,500,270,150,"CDC &amp; Batch Sources",["Postgres (RDS)","Salesforce"])
box(450,340,300,160,"Landing &amp; Storage",fill=BLUE,pills=["LANDING","STORAGE"])
sub_box(470,390,120,44,"Landing bucket"); sub_box(610,390,120,44,"Curated bucket")
s.append(f"<text x='600' y='470' {F} font-size='12' fill='{WHITE}' text-anchor='middle'>Amazon S3 · AWS Glue catalog</text>")
box(800,340,310,160,"Databricks jobs",["Classic compute in the VPC","Load curated → write to Snowflake"],pills=["TRANSFORM"])
box(450,560,660,90,"Network &amp; Access",["NAT egress · PrivateLink to Snowflake · IAM roles for Glue"])
box(1200,340,310,150,"Snowflake",["Snowflake DB (storage)","Warehouse (compute)"],pills=["MIRROR"])
box(1200,530,310,90,"Analytics consumers",["Qlik Cloud (Direct Query)"],fill=GREEN)
# flows
arrow([(360,400),(450,400)]); arrow([(360,560),(400,560),(400,420),(450,420)])
arrow([(750,420),(800,420)],badge="ELT"); arrow([(1110,420),(1200,420)])
arrow([(1355,490),(1355,530)]); arrow([(1355,340),(1355,290),(240,290),(240,230)],dashed=True)
arrow([(570,250),(570,290),(955,290),(955,340)],dashed=True)
s.append("</svg>")
open("/tmp/qsg/mock.svg","w").write("\n".join(s))
cairosvg.svg2png(url="/tmp/qsg/mock.svg", write_to="/tmp/qsg/mock.png", output_width=1600)
print("ok")

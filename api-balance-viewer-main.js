// API余额查看器 v7.1 - 大版面 WebView 仪表盘 + Widget 全尺寸 + iOS 16 严格兼容
// 零 forEach / 零 .then() / 零顶级 await
// WebView 全屏科技感 UI + ListWidget 自动适配深浅模式

// ========== 工具函数 ==========
function pad2(n) {
  var s = String(n);
  return s.length < 2 ? "0" + s : s;
}
function todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate());
}
function monthStartStr() {
  var d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-01";
}
function fmtNum(n) {
  if (n === null || n === undefined || n !== n) return "-";
  n = Number(n);
  if (n !== n) return "-";
  if (Math.abs(n) >= 1000000) return (n/1000000).toFixed(2) + "M";
  if (Math.abs(n) >= 1000) return (n/1000).toFixed(1) + "K";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}
function timeNow() {
  var d = new Date();
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}
function safeGetKeychain(key) {
  try { return Keychain.contains(key) ? Keychain.get(key) : null; } catch(e) { return null; }
}
function safeSetKeychain(key, val) {
  try { Keychain.set(key, val); return true; } catch(e) { return false; }
}
function safeRemoveKeychain(key) {
  try { if (Keychain.contains(key)) Keychain.remove(key); } catch(e) {}
}

// ========== 服务商配置 ==========
var PROVIDERS = [
  { id:"deepseek",  name:"DeepSeek",   icon:"DS", color:"#00D4FF", unit:"CNY", apiKeyHint:"sk-..." },
  { id:"openai",    name:"OpenAI",     icon:"AI", color:"#10A37F", unit:"USD", apiKeyHint:"sk-..." },
  { id:"anthropic", name:"Anthropic",  icon:"AN", color:"#D4A574", unit:"USD", apiKeyHint:"sk-ant-..." },
  { id:"aliyun",    name:"Aliyun BAIR",icon:"AL", color:"#FF6A00", unit:"CNY", apiKeyHint:"sk-..." },
  { id:"tencent",   name:"Tencent HY", icon:"TX", color:"#07C160", unit:"CNY", apiKeyHint:"sk-..." },
  { id:"kimi",      name:"Kimi",       icon:"KM", color:"#FF2E63", unit:"CNY", apiKeyHint:"sk-..." },
  { id:"zhipu",     name:"Zhipu GLM",  icon:"ZP", color:"#5B21B6", unit:"CNY", apiKeyHint:"sk-..." },
  { id:"custom",    name:"Custom API", icon:"CU", color:"#6B7280", unit:"CNY", apiKeyHint:"自定义Key" }
];
function getConfiguredIds() {
  try { var s = safeGetKeychain("api_bal_viewer_config_ids"); return s ? JSON.parse(s) : []; } catch(e) { return []; }
}
function saveConfiguredIds(ids) {
  try { safeSetKeychain("api_bal_viewer_config_ids", JSON.stringify(ids)); } catch(e) {}
}
function getThresholds() {
  try { var s = safeGetKeychain("api_bal_viewer_thresholds"); return s ? JSON.parse(s) : {}; } catch(e) { return {}; }
}
function saveThresholds(th) {
  try { safeSetKeychain("api_bal_viewer_thresholds", JSON.stringify(th)); } catch(e) {}
}

// ========== API 查询 ==========
async function fetchBalance(provider, apiKey) {
  if (!apiKey) return { success:false, error:"未配置API Key" };
  try {
    if (provider.id === "deepseek") {
      var req = new Request("https://api.deepseek.com/user/balance");
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      if (json && json.balance_infos && json.balance_infos.length > 0) {
        var bal = null, unit = "CNY";
        for (var bi = 0; bi < json.balance_infos.length; bi++) {
          if (json.balance_infos[bi].currency === "CNY") {
            bal = json.balance_infos[bi].total_balance; unit = "CNY"; break;
          }
        }
        if (bal === null) {
          bal = json.balance_infos[0].total_balance;
          unit = json.balance_infos[0].currency || "CNY";
        }
        return { success:true, balance:bal, unit:unit, raw:json };
      }
      if (json && json.balance) {
        var b = json.balance.total_balance !== undefined ? json.balance.total_balance : json.balance;
        return { success:true, balance:b, unit:provider.unit, raw:json };
      }
      if (json && json.error) return { success:false, error:"API:" + JSON.stringify(json.error).substring(0,100) };
      return { success:false, error:"格式异常:" + JSON.stringify(json).substring(0,150) };
    }
    if (provider.id === "openai") {
      var req = new Request("https://api.openai.com/v1/dashboard/billing/subscription");
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      var bal = json.hard_limit_usd !== undefined ? json.hard_limit_usd : null;
      return { success:true, balance:bal, unit:"USD", raw:json };
    }
    if (provider.id === "kimi") {
      var req = new Request("https://api.moonshot.cn/v1/users/me/balance");
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      var bal = json.balance !== undefined ? json.balance : null;
      return { success:true, balance:bal, unit:"CNY", raw:json };
    }
    if (provider.id === "anthropic") {
      return { success:true, balance:null, unit:"USD", notice:"请在Anthropic控制台查看余额" };
    }
    if (provider.id === "aliyun") {
      return { success:true, balance:null, unit:"CNY", notice:"请在阿里云百炼控制台查看" };
    }
    if (provider.id === "tencent") {
      return { success:true, balance:null, unit:"CNY", notice:"请在腾讯混元控制台查看" };
    }
    if (provider.id === "zhipu") {
      return { success:true, balance:null, unit:"CNY", notice:"请在智谱AI控制台查看" };
    }
    return { success:true, balance:null, unit:provider.unit, notice:"自定义API请查看对应控制台" };
  } catch(e) {
    return { success:false, error:String(e).substring(0,200) };
  }
}

async function fetchUsage(provider, apiKey) {
  var r = { todayTokens:null, monthTokens:null, todayDetail:"", monthDetail:"", usageRaw:null };
  if (!apiKey) return r;
  var today = todayStr();
  var ms = monthStartStr();
  try {
    if (provider.id === "deepseek") {
      var req = new Request("https://api.deepseek.com/user/usage?start_date=" + ms + "&end_date=" + today);
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      r.usageRaw = json;
      if (json && json.data) {
        var tT=0, tI=0, tO=0, mT=0, mI=0, mO=0;
        for (var di = 0; di < json.data.length; di++) {
          var d = json.data[di];
          var tk = (d.input_tokens||0) + (d.output_tokens||0);
          if (d.date === today) { tT += tk; tI += (d.input_tokens||0); tO += (d.output_tokens||0); }
          mT += tk; mI += (d.input_tokens||0); mO += (d.output_tokens||0);
        }
        r.todayTokens = tT; r.monthTokens = mT;
        r.todayDetail = "In " + fmtNum(tI) + " / Out " + fmtNum(tO);
        r.monthDetail = "In " + fmtNum(mI) + " / Out " + fmtNum(mO);
      } else if (json && json.code === 0) {
        r.todayTokens = 0; r.monthTokens = 0;
        r.todayDetail = "No data"; r.monthDetail = "No data";
      }
    }
    if (provider.id === "openai") {
      var req = new Request("https://api.openai.com/v1/dashboard/billing/usage?start_date=" + ms + "&end_date=" + today);
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      r.usageRaw = json;
      var tC=0, mC=0;
      if (json && json.daily_costs) {
        for (var di = 0; di < json.daily_costs.length; di++) {
          var d = json.daily_costs[di];
          var ds = d.start_time ? d.start_time.substring(0,10) : "";
          var c = 0;
          if (d.cost_data) { for (var k in d.cost_data) { c += d.cost_data[k]; } }
          mC += c; if (ds === today) tC += c;
        }
      }
      r.todayTokens = Math.round(tC*100)/100;
      r.monthTokens = Math.round(mC*100)/100;
      r.todayDetail = "$" + String(r.todayTokens);
      r.monthDetail = "$" + String(r.monthTokens);
    }
    if (provider.id === "kimi") {
      var req = new Request("https://api.moonshot.cn/v1/billing/usage?start_date=" + ms + "&end_date=" + today);
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      r.usageRaw = json;
      if (json && json.data) {
        r.todayTokens = json.data.today_tokens || 0;
        r.monthTokens = json.data.month_tokens || 0;
        r.todayDetail = fmtNum(r.todayTokens) + " tok";
        r.monthDetail = fmtNum(r.monthTokens) + " tok";
      }
    }
  } catch(e) { r.error = String(e).substring(0,100); }
  return r;
}

async function fetchAll() {
  var ids = getConfiguredIds();
  if (ids.length === 0) return [];
  var results = [];
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var prov = null;
    for (var j = 0; j < PROVIDERS.length; j++) {
      if (PROVIDERS[j].id === id) { prov = PROVIDERS[j]; break; }
    }
    if (!prov) continue;
    var apiKey = safeGetKeychain("api_bal_viewer_" + id);
    if (!apiKey) {
      results.push({ id:id, provider:prov, success:false, error:"未配置Key" });
      continue;
    }
    var balR = await fetchBalance(prov, apiKey);
    var usageR = await fetchUsage(prov, apiKey);
    results.push({
      id:id, provider:prov,
      success:balR.success,
      balance:balR.balance, unit:balR.unit || prov.unit,
      error:balR.error || null, notice:balR.notice || null,
      todayTokens:usageR.todayTokens, monthTokens:usageR.monthTokens,
      todayDetail:usageR.todayDetail, monthDetail:usageR.monthDetail
    });
  }
  return results;
}

function checkThresholds(results) {
  var th = getThresholds();
  var alerts = [];
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (!r.success || r.balance === null) continue;
    var balNum = Number(r.balance);
    if (balNum !== balNum) continue;
    var threshold = th[r.id] || th["_global"] || 5;
    if (balNum <= threshold) {
      alerts.push(r.provider.name + " low: " + fmtNum(balNum) + " " + r.unit);
    }
  }
  return alerts;
}

// ========== 大版面 WebView 仪表盘 HTML ==========
function buildDashboardHTML(results) {
  var now = new Date();
  var t = timeNow();
  var h = '<!DOCTYPE html><html><head>';
  h += '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">';
  h += '<meta name="apple-mobile-web-app-capable" content="yes">';
  h += '<style>';
  h += '*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}';
  h += 'html,body{height:100%;overflow:auto}';
  h += 'body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif;padding:20px 16px 40px';
  h += 'background:linear-gradient(160deg,#060B18 0%,#0D1B2A 30%,#1B2838 60%,#16213E 100%);color:#C8D6E5}';
  // Header
  h += '.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding:0 4px}';
  h += '.hdr h1{font-size:20px;font-weight:800;color:#00D4FF;letter-spacing:2px}';
  h += '.hdr-sub{font-size:11px;color:#4A6FA5;margin-top:4px;letter-spacing:1px}';
  h += '.hdr-time{font-size:11px;color:#3D5A80;font-family:"SF Mono",Menlo,monospace}';
  // Stats bar
  h += '.stats{display:flex;gap:8px;margin-bottom:20px}';
  h += '.stat{flex:1;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.12);border-radius:12px;padding:10px 12px;text-align:center}';
  h += '.stat-val{font-size:18px;font-weight:700;color:#00FF88;font-family:"SF Mono",Menlo,monospace}';
  h += '.stat-lbl{font-size:10px;color:#4A6FA5;margin-top:2px;letter-spacing:0.5px}';
  // Cards
  h += '.cards{display:flex;flex-direction:column;gap:12px}';
  h += '.card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px;position:relative;overflow:hidden}';
  h += '.card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:0 3px 3px 0}';
  h += '.card-top{display:flex;align-items:center;gap:10px;margin-bottom:12px}';
  h += '.card-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;letter-spacing:0.5px}';
  h += '.card-name{font-size:15px;font-weight:600;color:#E8E8E8;flex:1}';
  h += '.card-badge{font-size:10px;padding:3px 8px;border-radius:20px;font-weight:600;letter-spacing:0.5px}';
  h += '.badge-ok{background:rgba(0,255,136,0.1);color:#00FF88;border:1px solid rgba(0,255,136,0.2)}';
  h += '.badge-err{background:rgba(255,107,53,0.1);color:#FF6B35;border:1px solid rgba(255,107,53,0.2)}';
  h += '.card-bal{font-size:32px;font-weight:800;margin-bottom:4px;font-family:"SF Mono",Menlo,monospace;color:#00FF88;line-height:1.1}';
  h += '.card-unit{font-size:14px;color:#4A6FA5;font-weight:400;margin-left:6px}';
  h += '.card-notice{font-size:13px;color:#8899AA;padding:4px 0}';
  h += '.card-err-text{font-size:12px;color:#FF6B35;padding:4px 0;word-break:break-all}';
  // Usage grid
  h += '.usage{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}';
  h += '.usage-cell{background:rgba(255,255,255,0.03);border-radius:10px;padding:10px 12px}';
  h += '.usage-lbl{font-size:10px;color:#4A6FA5;letter-spacing:1px;margin-bottom:4px}';
  h += '.usage-val{font-size:15px;font-weight:700;color:#C8D6E5;font-family:"SF Mono",Menlo,monospace}';
  h += '.usage-detail{font-size:10px;color:#5C7A99;margin-top:2px}';
  // No usage
  h += '.no-usage{text-align:center;padding:8px;color:#3D5A80;font-size:12px}';
  // Empty state
  h += '.empty{text-align:center;padding:60px 20px;color:#4A6FA5}';
  h += '.empty-icon{font-size:48px;margin-bottom:16px;opacity:0.3}';
  h += '.empty-title{font-size:16px;font-weight:600;margin-bottom:8px;color:#6B8CBB}';
  h += '.empty-desc{font-size:12px;color:#3D5A80;line-height:1.6}';
  // Footer
  h += '.footer{text-align:center;margin-top:24px;font-size:10px;color:#2D4A6F;letter-spacing:1px;font-family:"SF Mono",Menlo,monospace}';
  // Light mode
  h += '@media(prefers-color-scheme:light){';
  h += 'body{background:linear-gradient(160deg,#F0F5FF,#E8F0FE,#DDE8F8);color:#1A2A3A}';
  h += '.hdr h1{color:#0088CC}';
  h += '.hdr-sub,.hdr-time{color:#8899AA}';
  h += '.stat{background:rgba(0,136,204,0.06);border-color:rgba(0,136,204,0.12)}';
  h += '.stat-val{color:#00AA55}';
  h += '.stat-lbl{color:#6688AA}';
  h += '.card{background:rgba(255,255,255,0.7);border-color:rgba(0,0,0,0.08)}';
  h += '.card-name{color:#1A2A3A}';
  h += '.card-bal{color:#00AA55}';
  h += '.card-unit,.card-notice{color:#6688AA}';
  h += '.card-err-text{color:#CC4422}';
  h += '.usage-cell{background:rgba(0,0,0,0.03)}';
  h += '.usage-lbl{color:#6688AA}.usage-val{color:#1A2A3A}.usage-detail{color:#8899AA}';
  h += '.badge-ok{background:rgba(0,170,85,0.1);color:#00AA55;border-color:rgba(0,170,85,0.2)}';
  h += '.badge-err{background:rgba(204,68,34,0.1);color:#CC4422;border-color:rgba(204,68,34,0.2)}';
  h += '.footer{color:#AABBCC}';
  h += '.empty{color:#6688AA}.empty-title{color:#4477AA}.empty-desc{color:#8899AA}';
  h += '.no-usage{color:#8899AA}';
  h += '}';
  h += '</style></head><body>';

  // Header
  h += '<div class="hdr"><div>';
  h += '<h1>API MONITOR</h1>';
  h += '<div class="hdr-sub">' + todayStr() + ' &middot; ONLINE</div>';
  h += '</div><div class="hdr-time">' + t + '</div></div>';

  // Stats bar
  var totalBal = 0, totalToday = 0, totalMonth = 0, balCount = 0;
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.success && r.balance !== null) {
      totalBal += Number(r.balance) || 0; balCount++;
    }
    if (r.todayTokens !== null) totalToday += r.todayTokens || 0;
    if (r.monthTokens !== null) totalMonth += r.monthTokens || 0;
  }
  h += '<div class="stats">';
  h += '<div class="stat"><div class="stat-val">' + results.length + '</div><div class="stat-lbl">SERVICES</div></div>';
  h += '<div class="stat"><div class="stat-val">' + (balCount > 0 ? fmtNum(totalBal) : "-") + '</div><div class="stat-lbl">TOTAL BAL</div></div>';
  h += '<div class="stat"><div class="stat-val">' + fmtNum(totalToday) + '</div><div class="stat-lbl">TODAY TOK</div></div>';
  h += '</div>';

  // Cards
  if (results.length > 0) {
    h += '<div class="cards">';
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var clr = r.provider.color || "#00D4FF";
      h += '<div class="card" style="border-left:3px solid ' + clr + '">';
      // Top row: icon + name + badge
      h += '<div class="card-top">';
      h += '<div class="card-icon" style="background:' + clr + '">' + r.provider.icon + '</div>';
      h += '<div class="card-name">' + r.provider.name + '</div>';
      if (r.success) {
        h += '<div class="card-badge badge-ok">ONLINE</div>';
      } else {
        h += '<div class="card-badge badge-err">ERROR</div>';
      }
      h += '</div>';
      // Balance
      if (r.success && r.balance !== null) {
        h += '<div class="card-bal">' + fmtNum(r.balance) + '<span class="card-unit">' + r.unit + '</span></div>';
      } else if (r.notice) {
        h += '<div class="card-notice">' + r.notice + '</div>';
      } else if (r.error) {
        h += '<div class="card-err-text">' + r.error + '</div>';
      }
      // Usage
      var hasUsage = (r.todayTokens !== null && r.todayTokens !== undefined) || (r.monthTokens !== null && r.monthTokens !== undefined);
      if (hasUsage) {
        h += '<div class="usage">';
        if (r.todayTokens !== null && r.todayTokens !== undefined) {
          h += '<div class="usage-cell"><div class="usage-lbl">TODAY</div>';
          h += '<div class="usage-val">' + fmtNum(r.todayTokens) + '</div>';
          if (r.todayDetail) h += '<div class="usage-detail">' + r.todayDetail + '</div>';
          h += '</div>';
        }
        if (r.monthTokens !== null && r.monthTokens !== undefined) {
          h += '<div class="usage-cell"><div class="usage-lbl">MONTH</div>';
          h += '<div class="usage-val">' + fmtNum(r.monthTokens) + '</div>';
          if (r.monthDetail) h += '<div class="usage-detail">' + r.monthDetail + '</div>';
          h += '</div>';
        }
        h += '</div>';
      } else if (r.success) {
        h += '<div class="no-usage">Usage data not available</div>';
      }
      h += '</div>';
    }
    h += '</div>';
  } else {
    h += '<div class="empty">';
    h += '<div class="empty-icon">API</div>';
    h += '<div class="empty-title">No Services Configured</div>';
    h += '<div class="empty-desc">Open this script in Scriptable app<br>to add API providers and keys</div>';
    h += '</div>';
  }

  // Footer
  h += '<div class="footer">UPDATED ' + t + ' &middot; AUTO REFRESH 30MIN</div>';
  h += '</body></html>';
  return h;
}

// ========== Widget 构建器 ==========
function buildWidget(results, family) {
  var widget = new ListWidget();

  // 渐变背景（自动适配深浅模式）
  var gradient = new LinearGradient();
  gradient.locations = [0, 0.5, 1];
  gradient.colors = [
    Color.dynamic(new Color("#E8F0FE"), new Color("#0A0E27")),
    Color.dynamic(new Color("#F0F4FF"), new Color("#111833")),
    Color.dynamic(new Color("#FFFFFF"), new Color("#1A1A2E"))
  ];
  widget.backgroundGradient = gradient;
  widget.setPadding(12, 12, 12, 12);

  if (family === "small") {
    return buildWidgetSmall(widget, results);
  }
  if (family === "large") {
    return buildWidgetLarge(widget, results);
  }
  // medium (default)
  return buildWidgetMedium(widget, results);
}

function buildWidgetSmall(widget, results) {
  // Title
  var titleRow = widget.addStack();
  var t1 = titleRow.addText("API MON");
  t1.font = Font.boldSystemFont(11);
  t1.color = Color.dynamic(new Color("#0088CC"), new Color("#00D4FF"));
  titleRow.addSpacer();
  var t2 = titleRow.addText(todayStr().substring(5));
  t2.font = Font.monoRoundedSystemFont(9);
  t2.color = Color.dynamic(new Color("#999"), new Color("#555"));
  widget.addSpacer(8);

  if (results.length === 0) {
    var et = widget.addText("No Data");
    et.font = Font.systemFont(11);
    et.color = Color.dynamic(new Color("#999"), new Color("#555"));
  } else {
    // Show first provider balance
    var r = results[0];
    var row = widget.addStack();
    var icon = row.addText(" " + r.provider.icon + " ");
    icon.font = Font.boldSystemFont(12);
    icon.color = new Color(r.provider.color);
    row.addSpacer(4);
    if (r.success && r.balance !== null) {
      var val = row.addText(fmtNum(r.balance) + " " + r.unit.substring(0,3));
      val.font = Font.boldMonoRoundedSystemFont(14);
      val.color = Color.dynamic(new Color("#333"), new Color("#00FF88"));
    } else {
      var val = row.addText("ERR");
      val.font = Font.boldSystemFont(12);
      val.color = new Color("#FF6B35");
    }
    widget.addSpacer(4);
    // Count
    if (results.length > 1) {
      var ct = widget.addText("+" + (results.length - 1) + " more");
      ct.font = Font.systemFont(9);
      ct.color = Color.dynamic(new Color("#AAA"), new Color("#555"));
    }
  }

  widget.addSpacer(8);
  var ft = widget.addStack();
  var ft1 = ft.addText(timeNow() + " ");
  ft1.font = Font.monoRoundedSystemFont(8);
  ft1.color = Color.dynamic(new Color("#BBB"), new Color("#444"));
  widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  return widget;
}

function buildWidgetMedium(widget, results) {
  // Title row
  var titleRow = widget.addStack();
  var t1 = titleRow.addText("API MONITOR");
  t1.font = Font.boldSystemFont(13);
  t1.color = Color.dynamic(new Color("#0088CC"), new Color("#00D4FF"));
  titleRow.addSpacer();
  var t2 = titleRow.addText(todayStr().substring(5));
  t2.font = Font.monoRoundedSystemFont(10);
  t2.color = Color.dynamic(new Color("#999"), new Color("#555"));
  widget.addSpacer(8);

  // Separator
  var sep = widget.addText("─".repeat(25));
  sep.font = Font.monoRoundedSystemFont(8);
  sep.textColor = Color.dynamic(new Color("#DDD"), new Color("#333"));
  widget.addSpacer(6);

  if (results.length === 0) {
    var et = widget.addText("  No configured services\n  Tap to setup");
    et.font = Font.systemFont(12);
    et.color = Color.dynamic(new Color("#999"), new Color("#555"));
  } else {
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var row = widget.addStack();
      row.centerAlignContent();

      // Icon circle
      var iconBg = row.addText(" " + r.provider.icon + " ");
      iconBg.font = Font.boldSystemFont(10);
      iconBg.color = new Color(r.provider.color);
      row.addSpacer(4);

      if (r.success && r.balance !== null) {
        var val = row.addText(fmtNum(r.balance));
        val.font = Font.boldMonoRoundedSystemFont(13);
        val.color = Color.dynamic(new Color("#222"), new Color("#00FF88"));
        row.addSpacer(2);
        var u = row.addText(r.unit.substring(0,3));
        u.font = Font.systemFont(9);
        u.color = Color.dynamic(new Color("#888"), new Color("#666"));
      } else if (r.notice) {
        var v2 = row.addText("N/A");
        v2.font = Font.systemFont(11);
        v2.color = Color.dynamic(new Color("#999"), new Color("#555"));
      } else {
        var v3 = row.addText("ERR");
        v3.font = Font.boldSystemFont(10);
        v3.color = new Color("#FF6B35");
      }

      // Token usage (right side)
      row.addSpacer();
      if (r.todayTokens !== null) {
        var tk = row.addText("T:" + fmtNum(r.todayTokens));
        tk.font = Font.monoRoundedSystemFont(9);
        tk.color = Color.dynamic(new Color("#777"), new Color("#888"));
      }

      widget.addSpacer(5);
    }
  }

  widget.addSpacer(6);
  // Footer
  var ft = widget.addStack();
  ft.addText(" ");
  var ft1 = ft.addText(timeNow() + " Updated");
  ft1.font = Font.monoRoundedSystemFont(8);
  ft1.color = Color.dynamic(new Color("#BBB"), new Color("#444"));
  ft.addSpacer();
  var ft2 = ft.addText("30m");
  ft2.font = Font.monoRoundedSystemFont(8);
  ft2.color = Color.dynamic(new Color("#CCC"), new Color("#555"));

  widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  return widget;
}

function buildWidgetLarge(widget, results) {
  // Title
  var titleRow = widget.addStack();
  var t1 = titleRow.addText("API MONITOR");
  t1.font = Font.boldSystemFont(15);
  t1.color = Color.dynamic(new Color("#0088CC"), new Color("#00D4FF"));
  titleRow.addSpacer();
  var t2 = titleRow.addText(todayStr());
  t2.font = Font.monoRoundedSystemFont(11);
  t2.color = Color.dynamic(new Color("#999"), new Color("#555"));
  widget.addSpacer(8);

  // Separator
  var sep = widget.addText("─".repeat(30));
  sep.font = Font.monoRoundedSystemFont(8);
  sep.textColor = Color.dynamic(new Color("#DDD"), new Color("#333"));
  widget.addSpacer(6);

  if (results.length === 0) {
    var et = widget.addText("  No configured services\n  Tap to setup");
    et.font = Font.systemFont(14);
    et.color = Color.dynamic(new Color("#999"), new Color("#555"));
  } else {
    for (var i = 0; i < results.length; i++) {
      var r = results[i];

      // Provider header row
      var hdr = widget.addStack();
      hdr.centerAlignContent();
      var ic = hdr.addText(" " + r.provider.icon + " ");
      ic.font = Font.boldSystemFont(11);
      ic.color = new Color(r.provider.color);
      var nm = hdr.addText(r.provider.name);
      nm.font = Font.boldSystemFont(13);
      nm.color = Color.dynamic(new Color("#222"), new Color("#DDD"));
      hdr.addSpacer();

      // Status + Balance (right aligned)
      if (r.success && r.balance !== null) {
        var bal = hdr.addText(fmtNum(r.balance) + " " + r.unit);
        bal.font = Font.boldMonoRoundedSystemFont(13);
        bal.color = Color.dynamic(new Color("#111"), new Color("#00FF88"));
      } else if (r.error) {
        var err = hdr.addText("ERR");
        err.font = Font.boldSystemFont(10);
        err.color = new Color("#FF6B35");
      }
      widget.addSpacer(3);

      // Usage detail row
      var hasUsage = (r.todayTokens !== null && r.todayTokens !== undefined) || (r.monthTokens !== null && r.monthTokens !== undefined);
      if (hasUsage) {
        var usageRow = widget.addStack();
        usageRow.addSpacer(20); // indent to align with name
        if (r.todayTokens !== null) {
          var td = usageRow.addText("Today: " + fmtNum(r.todayTokens));
          td.font = Font.monoRoundedSystemFont(10);
          td.color = Color.dynamic(new Color("#555"), new Color("#8899AA"));
          if (r.todayDetail) {
            var tdd = usageRow.addText(" (" + r.todayDetail + ")");
            tdd.font = Font.monoRoundedSystemFont(9);
            tdd.color = Color.dynamic(new Color("#999"), new Color("#556677"));
          }
        }
        usageRow.addSpacer(8);
        if (r.monthTokens !== null) {
          var md = usageRow.addText("Month: " + fmtNum(r.monthTokens));
          md.font = Font.monoRoundedSystemFont(10);
          md.color = Color.dynamic(new Color("#555"), new Color("#8899AA"));
          if (r.monthDetail) {
            var mdd = usageRow.addText(" (" + r.monthDetail + ")");
            mdd.font = Font.monoRoundedSystemFont(9);
            mdd.color = Color.dynamic(new Color("#999"), new Color("#556677"));
          }
        }
        widget.addSpacer(3);
      }

      // Card separator
      if (i < results.length - 1) {
        var sep2 = widget.addText("─".repeat(28));
        sep2.font = Font.monoRoundedSystemFont(6);
        sep2.textColor = Color.dynamic(new Color("#EEE"), new Color("#2A2A3E"));
        widget.addSpacer(3);
      }
    }
  }

  widget.addSpacer(6);
  // Footer
  var ft = widget.addStack();
  var ft1 = ft.addText(" " + timeNow() + " Updated");
  ft1.font = Font.monoRoundedSystemFont(9);
  ft1.color = Color.dynamic(new Color("#BBB"), new Color("#444"));
  ft.addSpacer();
  var ft2 = ft.addText("Auto 30min");
  ft2.font = Font.monoRoundedSystemFont(9);
  ft2.color = Color.dynamic(new Color("#CCC"), new Color("#555"));

  widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  return widget;
}

// ========== 配置菜单 ==========
async function showConfigMenu() {
  var ids = getConfiguredIds();
  while (true) {
    var alert = new Alert();
    alert.title = "CONFIGURE SERVICES";
    var msg = "Currently configured:\n\n";
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var p = null;
      for (var j = 0; j < PROVIDERS.length; j++) {
        if (PROVIDERS[j].id === id) { p = PROVIDERS[j]; break; }
      }
      if (p) msg += "[" + p.icon + "] " + p.name + "\n";
    }
    if (ids.length === 0) msg += "(none)";
    alert.message = msg;
    alert.addAction("Add / Remove");
    alert.addAction("Edit API Key");
    alert.addCancelAction("Back");
    var idx = await alert.presentAlert();
    if (idx === -1) return;
    if (idx === 0) await configToggleService();
    if (idx === 1) await configInputKey();
  }
}

async function configToggleService() {
  var ids = getConfiguredIds();
  var alert = new Alert();
  alert.title = "Select Provider";
  for (var i = 0; i < PROVIDERS.length; i++) {
    var p = PROVIDERS[i];
    var label = ids.indexOf(p.id) >= 0 ? "[x] " + p.icon + " " + p.name : "[ ] " + p.icon + " " + p.name;
    alert.addAction(label);
  }
  alert.addCancelAction("Cancel");
  var idx = await alert.presentActionSheet();
  if (idx === -1) return;
  var p = PROVIDERS[idx];
  var pos = ids.indexOf(p.id);
  if (pos >= 0) {
    ids.splice(pos, 1);
    safeRemoveKeychain("api_bal_viewer_" + p.id);
  } else {
    ids.push(p.id);
  }
  saveConfiguredIds(ids);
  // If added, prompt for key
  if (pos < 0) {
    var keyAlert = new Alert();
    keyAlert.title = p.name + " API Key";
    keyAlert.message = "Format: " + p.apiKeyHint;
    keyAlert.addTextField("API Key", "");
    keyAlert.addAction("Save");
    keyAlert.addCancelAction("Skip");
    var kIdx = await keyAlert.presentAlert();
    if (kIdx === 0) {
      var key = keyAlert.textFieldValue(0);
      if (key && key.trim().length > 0) {
        safeSetKeychain("api_bal_viewer_" + p.id, key.trim());
        var ok = new Alert();
        ok.title = "Saved";
        ok.message = p.name + " key saved\nPrefix: " + key.trim().substring(0,10) + "...";
        ok.addAction("OK");
        await ok.presentAlert();
      }
    }
  }
}

async function configInputKey() {
  var ids = getConfiguredIds();
  if (ids.length === 0) {
    var alert = new Alert();
    alert.title = "No Services";
    alert.message = "Please add a service first.";
    alert.addAction("OK");
    await alert.presentAlert();
    return;
  }
  var alert = new Alert();
  alert.title = "Edit API Key";
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var p = null;
    for (var j = 0; j < PROVIDERS.length; j++) {
      if (PROVIDERS[j].id === id) { p = PROVIDERS[j]; break; }
    }
    if (p) alert.addAction(p.icon + " " + p.name);
  }
  alert.addCancelAction("Cancel");
  var idx = await alert.presentActionSheet();
  if (idx === -1) return;
  var id = ids[idx];
  var p = null;
  for (var j = 0; j < PROVIDERS.length; j++) {
    if (PROVIDERS[j].id === id) { p = PROVIDERS[j]; break; }
  }
  if (!p) return;
  var keyAlert = new Alert();
  keyAlert.title = p.name + " API Key";
  var existing = safeGetKeychain("api_bal_viewer_" + id);
  keyAlert.addTextField("API Key", existing || "");
  keyAlert.addAction("Save");
  keyAlert.addCancelAction("Cancel");
  var kIdx = await keyAlert.presentAlert();
  if (kIdx === 0) {
    var key = keyAlert.textFieldValue(0);
    if (key && key.trim().length > 0) {
      safeSetKeychain("api_bal_viewer_" + id, key.trim());
      var ok = new Alert();
      ok.title = "Updated";
      ok.message = p.name + " API Key updated";
      ok.addAction("OK");
      await ok.presentAlert();
    }
  }
}

async function showThresholdMenu() {
  var th = getThresholds();
  var ids = getConfiguredIds();
  var alert = new Alert();
  alert.title = "Threshold Settings";
  var msg = "Alert when balance falls below threshold\n\n";
  msg += "Global default: " + (th["_global"] || 5) + "\n";
  msg += "Services: " + ids.length;
  alert.message = msg;
  alert.addAction("Set Global Threshold");
  if (ids.length > 0) alert.addAction("Set Per-Service");
  alert.addCancelAction("Back");
  var idx = await alert.presentAlert();
  if (idx === -1) return;
  if (idx === 0) {
    var input = new Alert();
    input.title = "Global Threshold";
    input.message = "Default for all providers";
    input.addTextField("Amount", String(th["_global"] || 5));
    input.addAction("Save");
    input.addCancelAction("Cancel");
    var r = await input.presentAlert();
    if (r === 0) {
      var v = parseFloat(input.textFieldValue(0));
      if (!isNaN(v) && v >= 0) { th["_global"] = v; saveThresholds(th); }
    }
  }
  if (idx === 1) {
    var sel = new Alert();
    sel.title = "Select Provider";
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var p = null;
      for (var j = 0; j < PROVIDERS.length; j++) {
        if (PROVIDERS[j].id === id) { p = PROVIDERS[j]; break; }
      }
      if (p) sel.addAction(p.icon + " " + p.name);
    }
    sel.addCancelAction("Cancel");
    var sIdx = await sel.presentActionSheet();
    if (sIdx === -1) return;
    var id = ids[sIdx];
    var p = null;
    for (var j = 0; j < PROVIDERS.length; j++) {
      if (PROVIDERS[j].id === id) { p = PROVIDERS[j]; break; }
    }
    if (p) {
      var input = new Alert();
      input.title = p.name + " Threshold";
      input.message = "Current: " + (th[id] || th["_global"] || 5);
      input.addTextField("Amount", String(th[id] || th["_global"] || 5));
      input.addAction("Save");
      input.addCancelAction("Cancel");
      var r = await input.presentAlert();
      if (r === 0) {
        var v = parseFloat(input.textFieldValue(0));
        if (!isNaN(v) && v >= 0) { th[id] = v; saveThresholds(th); }
      }
    }
  }
}

// ========== 入口 ==========
async function main() {
  // Widget mode
  if (config.runsInWidget) {
    var family = "medium";
    try { family = config.widgetFamily || "medium"; } catch(e) { family = "medium"; }
    var results = [];
    try { results = await fetchAll(); } catch(e) { results = []; }
    var widget = buildWidget(results, family);
    Script.setWidget(widget);
    Script.complete();
    return;
  }

  // Siri silent mode
  if (args.widgetParameter === "silent") {
    try {
      var results = await fetchAll();
      var alerts = checkThresholds(results);
      if (alerts.length > 0) {
        Notification.schedule("API Balance Alert", alerts.join("\n"));
      }
    } catch(e) {}
    return;
  }

  // In-app mode: Full-screen WebView dashboard
  while (true) {
    var results = [];
    try { results = await fetchAll(); } catch(e) { results = []; }

    // Show WebView dashboard (full-screen)
    try {
      var html = buildDashboardHTML(results);
      await WebView.loadHTML(html, null, null, true);
    } catch(e) {
      // Fallback: show as ListWidget
      try {
        var w = buildWidget(results, "large");
        await w.presentLarge();
      } catch(e2) {
        // Last resort: Alert
        var a = new Alert();
        a.title = "API MONITOR";
        a.message = "Dashboard error: " + String(e).substring(0,100);
        a.addAction("OK");
        await a.presentAlert();
      }
    }

    // After closing dashboard, show navigation menu
    var nav = new Alert();
    nav.title = "API MONITOR";
    var msg = todayStr() + " | " + results.length + " services active";
    if (results.length > 0) {
      msg += "\n\nLast refresh: " + timeNow();
    }
    nav.message = msg;
    nav.addAction("Refresh");
    nav.addAction("Configure Services");
    nav.addAction("Threshold Settings");
    nav.addCancelAction("Exit");
    var idx = await nav.presentAlert();

    if (idx === -1) return; // Exit
    if (idx === 0) continue; // Refresh (loop back)
    if (idx === 1) { await showConfigMenu(); continue; }
    if (idx === 2) { await showThresholdMenu(); continue; }
  }
}

main();

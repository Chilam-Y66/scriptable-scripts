// API余额查看器 v7.0 - 科技感 + iOS 16 严格兼容
// 无 forEach / 无 .then() / 无顶级 await / Widget 自动刷新

// ========== 工具函数 ==========
function pad2(n) {
  var s = String(n); return s.length < 2 ? "0" + s : s;
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
  n = Number(n); if (n !== n) return "-";
  if (Math.abs(n) >= 1000000) return (n/1000000).toFixed(2) + "M";
  if (Math.abs(n) >= 1000) return (n/1000).toFixed(1) + "K";
  if (Number.isInteger(n)) return String(n);
  return Number(n).toFixed(2);
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
  { id:"deepseek",  name:"DeepSeek",  icon:"DS", color:"#00D4FF", unit:"CNY", apiKeyHint:"sk-..." },
  { id:"openai",    name:"OpenAI",    icon:"AI", color:"#10A37F", unit:"USD", apiKeyHint:"sk-..." },
  { id:"anthropic", name:"Anthropic", icon:"AN", color:"#D4A574", unit:"USD", apiKeyHint:"sk-ant-..." },
  { id:"aliyun",    name:"Aliyun BAIR",icon:"AL", color:"#FF6A00", unit:"CNY", apiKeyHint:"阿里云API Key" },
  { id:"tencent",   name:"Tencent HY",icon:"TX", color:"#07C160", unit:"CNY", apiKeyHint:"腾讯云API Key" },
  { id:"kimi",      name:"Kimi",      icon:"KM", color:"#FF2E63", unit:"CNY", apiKeyHint:"sk-..." },
  { id:"zhipu",     name:"Zhipu GLM", icon:"ZP", color:"#5B21B6", unit:"CNY", apiKeyHint:"智谱API Key" },
  { id:"custom",     name:"Custom API",icon:"CU", color:"#6B7280", unit:"CNY", apiKeyHint:"自定义API Key" }
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
          var info = json.balance_infos[bi];
          if (info.currency === "CNY") { bal = info.total_balance; unit = "CNY"; break; }
        }
        if (bal === null) { bal = json.balance_infos[0].total_balance; unit = json.balance_infos[0].currency || "CNY"; }
        return { success:true, balance:bal, unit:unit, raw:json };
      }
      if (json && json.balance) {
        var b = json.balance.total_balance !== undefined ? json.balance.total_balance : json.balance;
        return { success:true, balance:b, unit:provider.unit, raw:json };
      }
      if (json && json.error) return { success:false, error:"API:" + JSON.stringify(json.error).substring(0,100) };
      return { success:false, error:"返回格式异常:" + JSON.stringify(json).substring(0,150) };
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
      return { success:true, balance:null, unit:"CNY", notice:"请在阿里云百炼控制台查看余额" };
    }
    if (provider.id === "tencent") {
      return { success:true, balance:null, unit:"CNY", notice:"请在腾讯云控制台查看余额" };
    }
    if (provider.id === "zhipu") {
      return { success:true, balance:null, unit:"CNY", notice:"请在智谱AI控制台查看余额" };
    }
    if (provider.id === "custom") {
      return { success:true, balance:null, unit:provider.unit, notice:"自定义API请在对应控制台查看" };
    }
    return { success:false, error:"未知服务商" };
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
        // API 返回成功但无数据
        r.todayTokens = 0; r.monthTokens = 0;
        r.todayDetail = "无记录"; r.monthDetail = "无记录";
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
        r.todayDetail = fmtNum(r.todayTokens) + " tokens";
        r.monthDetail = fmtNum(r.monthTokens) + " tokens";
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
      id: id, provider: prov,
      success: balR.success,
      balance: balR.balance, unit: balR.unit || prov.unit,
      error: balR.error || null,
      notice: balR.notice || null,
      todayTokens: usageR.todayTokens,
      monthTokens: usageR.monthTokens,
      todayDetail: usageR.todayDetail,
      monthDetail: usageR.monthDetail
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
      alerts.push(r.provider.name + " 余额低: " + fmtNum(balNum) + " " + r.unit);
    }
  }
  return alerts;
}

// ========== UI 构建函数 ==========
function buildDashboardText(results) {
  var msg = "";
  msg += "API MONITOR  v7.0\n";
  msg += todayStr() + "  |  ONLINE\n";
  msg += "---\n\n";
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    msg += "[" + r.provider.icon + "] " + r.provider.name + "\n";
    if (r.success) {
      if (r.balance !== null) {
        msg += "  BAL:  " + fmtNum(r.balance) + " " + r.unit + "\n";
      } else if (r.notice) {
        msg += "  INFO: " + r.notice + "\n";
      }
    } else {
      msg += "  ERR:  " + (r.error || "未知错误") + "\n";
    }
    // Token 用量 - 强制显示
    if (r.todayTokens !== null && r.todayTokens !== undefined) {
      msg += "  TODAY: " + fmtNum(r.todayTokens);
      if (r.todayDetail) msg += "  (" + r.todayDetail + ")";
      msg += "\n";
    }
    if (r.monthTokens !== null && r.monthTokens !== undefined) {
      msg += "  MONTH: " + fmtNum(r.monthTokens);
      if (r.monthDetail) msg += "  (" + r.monthDetail + ")";
      msg += "\n";
    }
    // 调试：如果没有任何用量数据，显示原始返回
    if (r.success && r.todayTokens === null && r.monthTokens === null) {
      msg += "  USAGE: 暂无用量数据\n";
      if (r.usageRaw) {
        var rawStr = JSON.stringify(r.usageRaw).substring(0, 80);
        msg += "  RAW: " + rawStr + "\n";
      }
    }
    msg += "---\n";
  }
  if (results.length === 0) {
    msg += "暂无配置的服务商\n请先添加";
  }
  return msg;
}

// ========== 菜单函数 ==========
async function showConfigMenu() {
  var ids = getConfiguredIds();
  while (true) {
    var alert = new Alert();
    alert.title = "CONFIGURE SERVICES";
    var msg = "ID  |  SERVICE\n";
    msg += "---\n";
    for (var i = 0; i < PROVIDERS.length; i++) {
      var p = PROVIDERS[i];
      var marked = ids.indexOf(p.id) >= 0 ? "OK" : "  ";
      msg += "[" + marked + "] " + p.icon + " " + p.name + "\n";
    }
    alert.message = msg;
    alert.addAction("添加/移除 选中");
    alert.addAction("输入 API Key");
    alert.addCancelAction("返回主菜单");
    var idx = await alert.presentAlert();
    if (idx === -1) return;
    if (idx === 0) await configToggleService();
    if (idx === 1) await configInputKey();
  }
}

async function configToggleService() {
  var ids = getConfiguredIds();
  var alert = new Alert();
  alert.title = "选择服务商";
  for (var i = 0; i < PROVIDERS.length; i++) {
    var p = PROVIDERS[i];
    var action = ids.indexOf(p.id) >= 0 ? "移除 " + p.icon : "添加 " + p.icon;
    alert.addAction(action);
  }
  alert.addCancelAction("取消");
  var idx = await alert.presentActionSheet();
  if (idx === -1) return;
  var p = PROVIDERS[idx];
  var pos = ids.indexOf(p.id);
  if (pos >= 0) {
    ids.splice(pos, 1);
    // 同时删除对应的 API Key
    safeRemoveKeychain("api_bal_viewer_" + p.id);
  } else {
    ids.push(p.id);
  }
  saveConfiguredIds(ids);
  // 如果是添加，提示用户输入 Key
  if (pos < 0) {
    var keyAlert = new Alert();
    keyAlert.title = "输入 " + p.name + " API Key";
    keyAlert.message = "Hint: " + p.apiKeyHint + "\n输入后自动保存";
    keyAlert.addTextField("API Key", "");
    keyAlert.addAction("保存");
    keyAlert.addCancelAction("跳过");
    var kIdx = await keyAlert.presentAlert();
    if (kIdx === 0) {
      var key = keyAlert.textFieldValue(0);
      if (key && key.trim().length > 0) {
        safeSetKeychain("api_bal_viewer_" + p.id, key.trim());
        var ok = new Alert();
        ok.title = "✓  保存成功";
        ok.message = p.name + " API Key 已保存\n前10位: " + key.trim().substring(0,10) + "...";
        ok.addAction("确定");
        await ok.presentAlert();
      }
    }
  }
}

async function configInputKey() {
  var ids = getConfiguredIds();
  if (ids.length === 0) {
    var alert = new Alert();
    alert.title = "提示";
    alert.message = "请先添加服务商";
    alert.addAction("确定");
    await alert.presentAlert();
    return;
  }
  var alert = new Alert();
  alert.title = "选择要输入 Key 的服务商";
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var p = null;
    for (var j = 0; j < PROVIDERS.length; j++) {
      if (PROVIDERS[j].id === id) { p = PROVIDERS[j]; break; }
    }
    if (p) alert.addAction(p.icon + " " + p.name);
  }
  alert.addCancelAction("取消");
  var idx = await alert.presentActionSheet();
  if (idx === -1) return;
  var id = ids[idx];
  var p = null;
  for (var j = 0; j < PROVIDERS.length; j++) {
    if (PROVIDERS[j].id === id) { p = PROVIDERS[j]; break; }
  }
  if (!p) return;
  var keyAlert = new Alert();
  keyAlert.title = "输入 " + p.name + " API Key";
  var existing = safeGetKeychain("api_bal_viewer_" + id);
  keyAlert.addTextField("API Key", existing || "");
  keyAlert.addAction("保存");
  keyAlert.addCancelAction("取消");
  var kIdx = await keyAlert.presentAlert();
  if (kIdx === 0) {
    var key = keyAlert.textFieldValue(0);
    if (key && key.trim().length > 0) {
      safeSetKeychain("api_bal_viewer_" + id, key.trim());
      var ok = new Alert();
      ok.title = "✓  保存成功";
      ok.message = p.name + " API Key 已更新";
      ok.addAction("确定");
      await ok.presentAlert();
    }
  }
}

async function showThresholdMenu() {
  var th = getThresholds();
  var ids = getConfiguredIds();
  var alert = new Alert();
  alert.title = "⚙  预警阈值设置";
  var msg = "余额低于阈值时查询后弹出提醒\n\n";
  msg += "全局默认: " + (th["_global"] || 5) + "\n";
  msg += "已配置服务商数量: " + ids.length + "\n";
  alert.message = msg;
  alert.addAction("设置全局阈值");
  if (ids.length > 0) alert.addAction("按服务商设置");
  alert.addCancelAction("返回主菜单");
  var idx = await alert.presentAlert();
  if (idx === -1) return;
  if (idx === 0) {
    var input = new Alert();
    input.title = "全局阈值";
    input.message = "所有服务商通用（默认 5）";
    input.addTextField("阈值金额", String(th["_global"] || 5));
    input.addAction("保存");
    input.addCancelAction("取消");
    var r = await input.presentAlert();
    if (r === 0) {
      var v = parseFloat(input.textFieldValue(0));
      if (!isNaN(v)) { th["_global"] = v; saveThresholds(th); }
    }
  }
  if (idx === 1) {
    // 按服务商设置
    var alert2 = new Alert();
    alert2.title = "选择服务商";
    for (var i = 0; i < ids.length; i++) {
      var p = null;
      for (var j = 0; j < PROVIDERS.length; j++) {
        if (PROVIDERS[j].id === ids[i]) { p = PROVIDERS[j]; break; }
      }
      if (p) alert2.addAction(p.icon + " " + p.name);
    }
    alert2.addCancelAction("取消");
    var idx2 = await alert2.presentActionSheet();
    if (idx2 === -1) return;
    var id = ids[idx2];
    var p = null;
    for (var j = 0; j < PROVIDERS.length; j++) {
      if (PROVIDERS[j].id === id) { p = PROVIDERS[j]; break; }
    }
    if (p) {
      var input = new Alert();
      input.title = p.name + " 阈值";
      input.message = "当前: " + (th[id] || th["_global"] || 5);
      input.addTextField("阈值金额", String(th[id] || th["_global"] || 5));
      input.addAction("保存");
      input.addCancelAction("取消");
      var r = await input.presentAlert();
      if (r === 0) {
        var v = parseFloat(input.textFieldValue(0));
        if (!isNaN(v)) { th[id] = v; saveThresholds(th); }
      }
    }
  }
}

async function showDashboard() {
  var results = [];
  try { results = await fetchAll(); } catch(e) { results = []; }
  if (!results) results = [];

  var text = buildDashboardText(results);

  var alert = new Alert();
  alert.title = "◆  QUERY RESULT";
  alert.message = text;
  alert.addAction("刷新");
  alert.addAction("配置");
  alert.addCancelAction("关闭");
  var idx = await alert.presentAlert();
  if (idx === 0) return await showDashboard();
  if (idx === 1) return await showConfigMenu();
  // idx === -1 (取消) 返回主菜单
}

// ========== 主菜单 ==========
async function mainMenu() {
  while (true) {
    var alert = new Alert();
    alert.title = "API MONITOR v7.0";
    var msg = "API BALANCE VIEWER\n";
    msg += todayStr() + " | v7.0\n\n";
    var ids = getConfiguredIds();
    msg += "已配置: " + ids.length + " 个服务商";
    alert.message = msg;
    alert.addAction("[1] 查询余额");
    alert.addAction("[2] 配置服务商");
    alert.addAction("[3] 预警阈值");
    alert.addCancelAction("[0] 退出");
    var idx = await alert.presentAlert();
    if (idx === -1) return;  // 退出
    if (idx === 0) await showDashboard();
    if (idx === 1) await showConfigMenu();
    if (idx === 2) await showThresholdMenu();
    // 循环继续
  }
}

// ========== Widget 构建 ==========
async function buildWidget() {
  var widget = new ListWidget();
  
  // 背景渐变（自动适配浅色/深色模式）
  var bgColor = Color.dynamic(new Color("#F0F4FF"), new Color("#0A0E27"));
  widget.backgroundColor = bgColor;
  
  var gradient = new LinearGradient();
  gradient.locations = [0, 0.5, 1];
  gradient.colors = [
    Color.dynamic(new Color("#E8F0FE"), new Color("#0A0E27")),
    Color.dynamic(new Color("#F0F4FF"), new Color("#101638")),
    Color.dynamic(new Color("#FFFFFF"), new Color("#1A1A2E"))
  ];
  widget.backgroundGradient = gradient;

  // 标题
  var titleRow = widget.addStack();
  var titleText = titleRow.addText("◆ API MONITOR");
  titleText.font = Font.boldSystemFont(12);
  titleText.color = Color.dynamic(new Color("#00A8E8"), new Color("#00D4FF"));
  titleRow.addSpacer();
  var dateText = titleRow.addText(todayStr().substring(5)); // MM-DD
  dateText.font = Font.monoRoundedSystemFont(10);
  dateText.color = Color.dynamic(new Color("#888888"), new Color("#666666"));

  widget.addSpacer(6);

  // 分隔线
  var sep = widget.addStack();
  var sepText = sep.addText("────────────────────");
  sepText.font = Font.monoRoundedSystemFont(10);
  sepText.color = Color.dynamic(new Color("#CCCCCC"), new Color("#333333"));

  widget.addSpacer(4);

  // 查询数据
  var results = [];
  try { results = await fetchAll(); } catch(e) { results = []; }

  if (results.length === 0) {
    var emptyText = widget.addText("  暂无配置\n  请先添加");
    emptyText.font = Font.systemFont(11);
    emptyText.color = Color.dynamic(new Color("#888888"), new Color("#666666"));
  } else {
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var row = widget.addStack();
      var iconText = row.addText(" " + r.provider.icon + " ");
      iconText.font = Font.boldSystemFont(11);
      iconText.color = new Color(r.provider.color);
      
      row.addSpacer(4);
      
      var valText;
      if (r.success && r.balance !== null) {
        valText = row.addText(fmtNum(r.balance) + " " + (r.unit && r.unit.length >= 2 ? r.unit.substring(0,3) : r.unit || ""));
        valText.color = Color.dynamic(new Color("#000000"), new Color("#00FF88"));
      } else if (r.notice) {
        valText = row.addText("N/A");
        valText.color = Color.dynamic(new Color("#888888"), new Color("#555555"));
      } else {
        valText = row.addText("ERR");
        valText.color = new Color("#FF6B35");
      }
      valText.font = Font.monoRoundedSystemFont(11);
      
      // 用量（小字）
      if (r.todayTokens !== null) {
        row.addSpacer(4);
        var usageText = row.addText("T:" + fmtNum(r.todayTokens));
        usageText.font = Font.monoRoundedSystemFont(8);
        usageText.color = Color.dynamic(new Color("#666666"), new Color("#888888"));
      }
      
      widget.addSpacer(3);
    }
  }

  widget.addSpacer(4);

  // 底部时间
  var footer = widget.addStack();
  var now = new Date();
  var timeStr = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
  var footerText = footer.addText("  " + timeStr + "  Updated");
  footerText.font = Font.monoRoundedSystemFont(8);
  footerText.color = Color.dynamic(new Color("#AAAAAA"), new Color("#444444"));

  // 建议系统 30 分钟后刷新
  widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

  return widget;
}

// ========== 入口 ==========
async function main() {
  if (config.runsInWidget) {
    var widget = await buildWidget();
    Script.setWidget(widget);
    Script.complete();
    return;
  }

  // Siri 静默模式
  if (args.widgetParameter === "silent") {
    try {
      var results = await fetchAll();
      var alerts = checkThresholds(results);
      if (alerts.length > 0) {
        Notification.schedule("余额预警", alerts.join("\n"));
      }
    } catch(e) {}
    return;
  }

  // 正常启动主菜单
  await mainMenu();
}

main();

// API余额查看器 v6.5 - iOS 16 严格兼容
// 零 forEach / 零 .then() / 零顶级 await / 零 emoji

function pad2(n) {
  var s = String(n); return s.length < 2 ? "0" + s : s;
}
function todayStr() {
  var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate());
}
function monthStartStr() {
  var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-01";
}
function fmtNum(n) {
  if (n === null || n === undefined || n !== n) return "-";
  n = Number(n); if (n !== n) return "-";
  if (n >= 1000000) return (n/1000000).toFixed(2) + "M";
  if (n >= 1000) return (n/1000).toFixed(1) + "K";
  return String(n);
}
function safeGetKeychain(key) {
  try { return Keychain.contains(key) ? Keychain.get(key) : null; } catch(e) { return null; }
}
function safeSetKeychain(key, val) {
  try { Keychain.set(key, val); return true; } catch(e) { return false; }
}
function safeRemoveKeychain(key) {
  try { Keychain.remove(key); } catch(e) {}
}

var PROVIDERS = [
  { id:"deepseek", name:"DeepSeek", icon:"[DS]", color:"#4361EE", unit:"CNY", apiKeyHint:"sk-..." },
  { id:"openai",   name:"OpenAI",   icon:"[AI]", color:"#10A37F", unit:"USD", apiKeyHint:"sk-..." },
  { id:"anthropic",name:"Anthropic",icon:"[AN]", color:"#D4A574", unit:"USD", apiKeyHint:"sk-ant-..." },
  { id:"aliyun",   name:"Aliyun BAIR", icon:"[AL]", color:"#FF6A00", unit:"CNY", apiKeyHint:"阿里云API Key" },
  { id:"tencent",  name:"Tencent HY", icon:"[TX]", color:"#07C160", unit:"CNY", apiKeyHint:"腾讯云API Key" },
  { id:"kimi",     name:"Kimi",       icon:"[KM]", color:"#FF2E63", unit:"CNY", apiKeyHint:"sk-..." },
  { id:"zhipu",    name:"Zhipu GLM",  icon:"[ZP]", color:"#5B21B6", unit:"CNY", apiKeyHint:"智谱AI API Key" },
  { id:"custom",    name:"Custom API",  icon:"[CU]", color:"#6B7280", unit:"CNY", apiKeyHint:"自定义API Key" }
];

function getConfiguredIds() {
  try { var s = Keychain.get("api_bal_viewer_config_ids"); return s ? JSON.parse(s) : []; } catch(e) { return []; }
}
function saveConfiguredIds(ids) {
  try { Keychain.set("api_bal_viewer_config_ids", JSON.stringify(ids)); } catch(e) {}
}
function getThresholds() {
  try { var s = Keychain.get("api_bal_viewer_thresholds"); return s ? JSON.parse(s) : {}; } catch(e) { return {}; }
}
function saveThresholds(th) {
  try { Keychain.set("api_bal_viewer_thresholds", JSON.stringify(th)); } catch(e) {}
}

// ========== 查询余额 ==========
async function fetchBalance(provider, apiKey) {
  if (!apiKey) return { success:false, error:"未配置API Key" };
  try {
    if (provider.id === "deepseek") {
      var req = new Request("https://api.deepseek.com/user/balance");
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      if (json && json.balance) {
        var bal = json.balance.total_balance !== undefined ? json.balance.total_balance : json.balance;
        return { success:true, balance: bal, raw:json };
      }
      return { success:false, error:"返回格式异常" };
    }
    if (provider.id === "openai") {
      var req = new Request("https://api.openai.com/v1/dashboard/billing/subscription");
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      var bal = json.hard_limit_usd !== undefined ? json.hard_limit_usd : null;
      return { success:true, balance: bal, raw:json };
    }
    if (provider.id === "kimi") {
      var req = new Request("https://api.moonshot.cn/v1/users/me/balance");
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      var bal = json.balance !== undefined ? json.balance : null;
      return { success:true, balance: bal, raw:json };
    }
    return { success:true, balance:null, notice:"请在对应控制台查看余额" };
  } catch(e) {
    return { success:false, error:String(e) };
  }
}

// ========== 查询用量 ==========
async function fetchUsage(provider, apiKey) {
  var r = { todayTokens:null, monthTokens:null, todayDetail:"", monthDetail:"" };
  var today = todayStr();
  var ms = monthStartStr();
  try {
    if (provider.id === "deepseek") {
      var req = new Request("https://api.deepseek.com/user/usage?start_date=" + ms + "&end_date=" + today);
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
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
      }
    }
    if (provider.id === "openai") {
      var req = new Request("https://api.openai.com/v1/dashboard/billing/usage?start_date=" + ms + "&end_date=" + today);
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      var tC=0, mC=0;
      if (json && json.daily_costs) {
        for (var di = 0; di < json.daily_costs.length; di++) {
          var d = json.daily_costs[di];
          var ds = d.start_time ? d.start_time.substring(0,10) : "";
          var c = 0;
          if (d.cost_data) { for (var k in d.cost_data) c += d.cost_data[k]; }
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
      if (json && json.data) {
        r.todayTokens = json.data.today_tokens || 0;
        r.monthTokens = json.data.month_tokens || 0;
        r.todayDetail = fmtNum(r.todayTokens) + " tokens";
        r.monthDetail = fmtNum(r.monthTokens) + " tokens";
      }
    }
  } catch(e) {}
  return r;
}

// ========== 并发查询所有 ==========
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
      id: prov.id, provider: prov,
      success: balR.success,
      balance: balR.balance, unit: prov.unit,
      error: balR.error || null,
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

// ========== 主菜单 ==========
async function mainMenu() {
  while (true) {
    var mAlert = new Alert();
    mAlert.title = "API余额查看器";
    mAlert.message = "请选择操作";
    mAlert.addAction("查询余额");
    mAlert.addAction("配置服务商");
    mAlert.addAction("设置预警阈值");
    mAlert.addCancelAction("退出");
    var idx = await mAlert.presentAlert();
    if (idx === 2) break;
    if (idx === 0) await showDashboard();
    if (idx === 1) await showConfigMenu();
  }
}

// ========== 显示仪表盘 ==========
async function showDashboard() {
  var results = [];
  try { results = await fetchAll(); } catch(e) { results = []; }
  if (!results) results = [];
  var rAlert = new Alert();
  rAlert.title = "查询结果";
  var msg = "";
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    msg += r.provider.icon + " " + r.provider.name + "\n";
    if (r.success) {
      msg += "  余额: " + (r.balance !== null ? fmtNum(r.balance) + " " + r.unit : "N/A") + "\n";
      if (r.todayTokens !== null) msg += "  今日: " + fmtNum(r.todayTokens) + " tok\n";
      if (r.monthTokens !== null) msg += "  本月: " + fmtNum(r.monthTokens) + " tok\n";
    } else {
      msg += "  错误: " + (r.error || "未知") + "\n";
    }
    msg += "\n";
  }
  if (results.length === 0) msg = "暂无配置的服务商\n请先添加";
  rAlert.message = msg;
  rAlert.addAction("刷新");
  rAlert.addAction("配置");
  rAlert.addCancelAction("关闭");
  var idx = await rAlert.presentAlert();
  if (idx === 0) await showDashboard();
  if (idx === 1) await showConfigMenu();
}

// ========== 配置菜单 ==========
async function showConfigMenu() {
  while (true) {
    var ids = getConfiguredIds();
    var cAlert = new Alert();
    cAlert.title = "配置服务商";
    cAlert.message = "已配置: " + (ids.length > 0 ? ids.length + " 个" : "无");
    cAlert.addAction("添加服务商");
    if (ids.length > 0) cAlert.addAction("编辑/删除已配置");
    cAlert.addCancelAction("返回");
    var idx = await cAlert.presentAlert();
    if (idx === 2) break;
    if (idx === 0) await addProvider();
    if (idx === 1) await editProvider();
  }
}

async function addProvider() {
  var avail = [];
  var ids = getConfiguredIds();
  for (var i = 0; i < PROVIDERS.length; i++) {
    if (ids.indexOf(PROVIDERS[i].id) < 0) avail.push(PROVIDERS[i]);
  }
  if (avail.length === 0) {
    var nAlert = new Alert();
    nAlert.title = "提示";
    nAlert.message = "所有服务商已配置";
    nAlert.addCancelAction("确定");
    await nAlert.presentAlert();
    return;
  }
  var sAlert = new Alert();
  sAlert.title = "选择服务商";
  sAlert.message = "添加要查询的服务商";
  for (var i = 0; i < avail.length; i++) { sAlert.addAction(avail[i].icon + " " + avail[i].name); }
  sAlert.addCancelAction("取消");
  var idx = await sAlert.presentAlert();
  if (idx >= avail.length) return;
  var prov = avail[idx];
  var kAlert = new Alert();
  kAlert.title = "输入 API Key";
  kAlert.message = prov.name + "\n提示: " + prov.apiKeyHint;
  kAlert.addTextField("API Key", "");
  kAlert.addAction("保存");
  kAlert.addCancelAction("取消");
  var kIdx = await kAlert.presentAlert();
  if (kIdx !== 0) return;
  var key = kAlert.textFieldValue(0);
  if (!key || key.trim() === "") {
    var eAlert = new Alert();
    eAlert.title = "错误";
    eAlert.message = "API Key 不能为空";
    eAlert.addCancelAction("确定");
    await eAlert.presentAlert();
    return;
  }
  safeSetKeychain("api_bal_viewer_" + prov.id, key.trim());
  ids = getConfiguredIds();
  ids.push(prov.id);
  saveConfiguredIds(ids);
  var okAlert = new Alert();
  okAlert.title = "成功";
  okAlert.message = prov.name + " 已添加";
  okAlert.addCancelAction("确定");
  await okAlert.presentAlert();
}

async function editProvider() {
  var ids = getConfiguredIds();
  if (ids.length === 0) return;
  var eAlert = new Alert();
  eAlert.title = "选择要编辑的服务商";
  for (var i = 0; i < ids.length; i++) {
    var p = null;
    for (var k = 0; k < PROVIDERS.length; k++) { if (PROVIDERS[k].id === ids[i]) { p = PROVIDERS[k]; break; } }
    eAlert.addAction((p ? p.icon + " " + p.name : ids[i]));
  }
  eAlert.addCancelAction("取消");
  var idx = await eAlert.presentAlert();
  if (idx >= ids.length) return;
  var pid = ids[idx];
  var prov = null;
  for (var k = 0; k < PROVIDERS.length; k++) { if (PROVIDERS[k].id === pid) { prov = PROVIDERS[k]; break; } }
  var dAlert = new Alert();
  dAlert.title = (prov ? prov.name : pid);
  dAlert.message = "选择操作";
  dAlert.addAction("修改 API Key");
  dAlert.addAction("删除此服务商");
  dAlert.addCancelAction("返回");
  var dIdx = await dAlert.presentAlert();
  if (dIdx === 2) return;
  if (dIdx === 0) {
    var kAlert = new Alert();
    kAlert.title = "修改 API Key";
    kAlert.message = prov ? prov.name : pid;
    var oldKey = safeGetKeychain("api_bal_viewer_" + pid);
    kAlert.addTextField("新 API Key", oldKey || "");
    kAlert.addAction("保存");
    kAlert.addCancelAction("取消");
    var kIdx = await kAlert.presentAlert();
    if (kIdx === 0) {
      var newKey = kAlert.textFieldValue(0);
      if (newKey && newKey.trim() !== "") {
        safeSetKeychain("api_bal_viewer_" + pid, newKey.trim());
        var okAlert = new Alert();
        okAlert.title = "成功";
        okAlert.message = "API Key 已更新";
        okAlert.addCancelAction("确定");
        await okAlert.presentAlert();
      }
    }
  }
  if (dIdx === 1) {
    var cfAlert = new Alert();
    cfAlert.title = "确认删除";
    cfAlert.message = "确定要删除 " + (prov ? prov.name : pid) + "？";
    cfAlert.addAction("确认删除");
    cfAlert.addCancelAction("取消");
    var cfIdx = await cfAlert.presentAlert();
    if (cfIdx === 0) {
      safeRemoveKeychain("api_bal_viewer_" + pid);
      ids = getConfiguredIds();
      var newIds = [];
      for (var i = 0; i < ids.length; i++) { if (ids[i] !== pid) newIds.push(ids[i]); }
      saveConfiguredIds(newIds);
    }
  }
}

// ========== 预警阈值设置 ==========
async function showThresholdMenu() {
  while (true) {
    var th = getThresholds();
    var tAlert = new Alert();
    tAlert.title = "余额预警阈值";
    tAlert.message = "设置各服务商余额低于多少时预警通知\n当前全局默认: " + String(th["_global"] || 5);
    tAlert.addAction("设置全局默认");
    var ids = getConfiguredIds();
    for (var i = 0; i < ids.length; i++) {
      var p = null;
      for (var k = 0; k < PROVIDERS.length; k++) { if (PROVIDERS[k].id === ids[i]) { p = PROVIDERS[k]; break; } }
      if (p) tAlert.addAction(p.icon + " " + p.name + " (当前:" + String(th[p.id] || th["_global"] || 5) + ")");
    }
    tAlert.addCancelAction("返回主菜单");
    var idx = await tAlert.presentAlert();
    if (idx >= 1000) break;
    if (idx === 0) {
      var eAlert = new Alert();
      eAlert.title = "全局默认阈值";
      eAlert.message = "余额低于此数值时发送预警（单位同服务商）";
      eAlert.addTextField("阈值", String(th["_global"] || 5));
      eAlert.addAction("保存");
      eAlert.addCancelAction("取消");
      var eIdx = await eAlert.presentAlert();
      if (eIdx === 0) {
        var v = Number(eAlert.textFieldValue(0));
        if (v === v && v > 0) { th["_global"] = v; saveThresholds(th); }
      }
    } else {
      var pid = ids[idx - 1];
      var p = null;
      for (var k = 0; k < PROVIDERS.length; k++) { if (PROVIDERS[k].id === pid) { p = PROVIDERS[k]; break; } }
      var eAlert = new Alert();
      eAlert.title = (p ? p.name : pid) + " 阈值";
      eAlert.message = "留空则使用全局默认";
      eAlert.addTextField("阈值", th[pid] ? String(th[pid]) : "");
      eAlert.addAction("保存");
      eAlert.addAction("使用全局默认");
      eAlert.addCancelAction("取消");
      var eIdx = await eAlert.presentAlert();
      if (eIdx === 0) {
        var v = eAlert.textFieldValue(0);
        if (v && v.trim() !== "") { th[pid] = Number(v); } else { delete th[pid]; }
        saveThresholds(th);
      }
      if (eIdx === 1) { delete th[pid]; saveThresholds(th); }
    }
  }
}

// ========== Widget 支持 ==========
if (config.runsInWidget) {
  (async function() {
    var widget = new ListWidget();
    widget.setPadding(12, 12, 12, 12);
    var titleTxt = widget.addText("API余额");
    titleTxt.font = Font.boldSystemFont(14);
    titleTxt.textColor = new Color("#333333");
    widget.addSpacer(6);
    try {
      var results = await fetchAll();
      if (results.length === 0) {
        var t = widget.addText("未配置服务商");
        t.font = Font.systemFont(11);
        t.textColor = Color.gray();
      } else {
        for (var i = 0; i < results.length; i++) {
          var r = results[i];
          var line = r.provider.icon + " ";
          if (r.success && r.balance !== null) {
            line += fmtNum(r.balance) + " " + r.unit;
          } else {
            line += "error";
          }
          var t = widget.addText(line);
          t.font = Font.systemFont(11);
          t.textColor = r.success ? new Color("#333333") : Color.red();
        }
      }
    } catch(e) {
      var t = widget.addText("加载失败");
      t.font = Font.systemFont(11);
      t.textColor = Color.red();
    }
    widget.addSpacer();
    var footer = widget.addText(todayStr());
    footer.font = Font.systemFont(9);
    footer.textColor = Color.gray();
    Script.setWidget(widget);
    Script.complete();
  })();
}

// ========== Siri 支持 ==========
if (args.widgetParameter === "silent") {
  (async function() {
    try {
      var results = await fetchAll();
      var alerts = checkThresholds(results);
      if (alerts.length > 0) {
        Notification.schedule("余额预警", alerts.join("\n"));
      }
    } catch(e) {}
    Script.complete();
  })();
}

// ========== 正常启动 ==========
if (!config.runsInWidget && args.widgetParameter !== "silent") {
  mainMenu();
}

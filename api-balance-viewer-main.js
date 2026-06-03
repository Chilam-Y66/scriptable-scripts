// API余额查看器 v6.2 - iOS 16 兼容版
// 全部使用 await，不使用 .then()
// 单文件自包含

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
  { id:"deepseek", name:"DeepSeek",   icon:"[DS]", color:"#4361EE", unit:"CNY" },
  { id:"openai",   name:"OpenAI",      icon:"[AI]", color:"#10A37F", unit:"USD" },
  { id:"anthropic", name:"Anthropic", icon:"[AN]", color:"#D4A574", unit:"USD" },
  { id:"aliyun",   name:"Aliyun BAIR", icon:"[AL]", color:"#FF6A00", unit:"CNY" },
  { id:"tencent",  name:"Tencent HY",  icon:"[TX]", color:"#07C160", unit:"CNY" },
  { id:"kimi",     name:"Kimi",         icon:"[KM]", color:"#FF2E63", unit:"CNY" },
  { id:"zhipu",    name:"Zhipu GLM",    icon:"[ZP]", color:"#5B21B6", unit:"CNY" },
  { id:"custom",   name:"Custom API",   icon:"[CU]", color:"#6B7280", unit:"CNY" },
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
  if (!apiKey) return { success:false, error:"未配置 API Key" };
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
        var tT=0,tI=0,tO=0,mT=0,mI=0,mO=0;
        json.data.forEach(function(d) {
          var tk = (d.input_tokens||0)+(d.output_tokens||0);
          if(d.date===today){tT+=tk;tI+=(d.input_tokens||0);tO+=(d.output_tokens||0);}
          mT+=tk;mI+=(d.input_tokens||0);mO+=(d.output_tokens||0);
        });
        r.todayTokens=tT; r.monthTokens=mT;
        r.todayDetail="In "+fmtNum(tI)+" / Out "+fmtNum(tO);
        r.monthDetail="In "+fmtNum(mI)+" / Out "+fmtNum(mO);
      }
    }
    if (provider.id === "openai") {
      var req = new Request("https://api.openai.com/v1/dashboard/billing/usage?start_date=" + ms + "&end_date=" + today);
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      var tC=0,mC=0;
      if(json&&json.daily_costs){json.daily_costs.forEach(function(d){
        var ds=d.start_time?d.start_time.substring(0,10):"";
        var c=0;if(d.cost_data){for(var k in d.cost_data)c+=d.cost_data[k];}
        mC+=c;if(ds===today)tC+=c;
      });}
      r.todayTokens=Math.round(tC*100)/100;
      r.monthTokens=Math.round(mC*100)/100;
      r.todayDetail="$"+String(r.todayTokens);
      r.monthDetail="$"+String(r.monthTokens);
    }
    if (provider.id === "kimi") {
      var req = new Request("https://api.moonshot.cn/v1/billing/usage?start_date=" + ms + "&end_date=" + today);
      req.headers = { "Authorization": "Bearer " + apiKey };
      var json = await req.loadJSON();
      if(json&&json.data){
        r.todayTokens=json.data.today_tokens||0;
        r.monthTokens=json.data.month_tokens||0;
        r.todayDetail=fmtNum(r.todayTokens)+" tokens";
        r.monthDetail=fmtNum(r.monthTokens)+" tokens";
      }
    }
  } catch(e) {}
  return r;
}

// ========== 并发查询所有 ==========
async function fetchAll() {
  var ids = getConfiguredIds();
  if (ids.length === 0) return [];
  var promises = [];
  ids.forEach(function(id) {
    var prov = null;
    PROVIDERS.forEach(function(p) { if (p.id === id) prov = p; });
    if (!prov) return;
    var apiKey = safeGetKeychain("api_bal_viewer_" + id);
    if (!apiKey) { promises.push(Promise.resolve({ id:id, provider:prov, success:false, error:"未配置Key" })); return; }
    promises.push((async function() {
      var balR = await fetchBalance(prov, apiKey);
      var usageR = await fetchUsage(prov, apiKey);
      return {
        id: id, provider: prov,
        success: balR.success,
        balance: balR.balance, unit: prov.unit,
        error: balR.error || null,
        todayTokens: usageR.todayTokens,
        monthTokens: usageR.monthTokens,
        todayDetail: usageR.todayDetail,
        monthDetail: usageR.monthDetail
      };
    })());
  });
  return await Promise.all(promises);
}

function checkThresholds(results) {
  var th = getThresholds();
  var alerts = [];
  results.forEach(function(r) {
    if (!r.success || r.balance === null) return;
    var balNum = Number(r.balance);
    if (balNum !== balNum) return;
    var threshold = th[r.id] || th["_global"] || 5;
    if (balNum <= threshold) {
      alerts.push(r.provider.name + " 余额低: " + fmtNum(balNum) + " " + r.unit);
    }
  });
  return alerts;
}

// ========== 显示仪表盘 ==========
async function showDashboard() {
  // 直接查询余额，不用 loading alert（iOS 16 兼容）
  var results = [];
  try {
    results = await fetchAll();
  } catch(e) {
    results = [];
  }
  if (!results) results = [];

  // 显示结果
  var rAlert = new Alert();
  rAlert.title = "查询结果";
  var msg = "";
  results.forEach(function(r) {
    msg += r.provider.icon + " " + r.provider.name + "\n";
    if (r.success) {
      msg += "  余额: " + (r.balance !== null ? fmtNum(r.balance) + " " + r.unit : "N/A") + "\n";
      if (r.todayTokens !== null) msg += "  今日: " + fmtNum(r.todayTokens) + " tok\n";
      if (r.monthTokens !== null) msg += "  本月: " + fmtNum(r.monthTokens) + " tok\n";
    } else {
      msg += "  错误: " + (r.error || "未知") + "\n";
    }
    msg += "\n";
  });
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
  var alert = new Alert();
  alert.title = "配置管理";
  var ids = getConfiguredIds();
  var msg = "已配置: " + (ids.length === 0 ? "无" : ids.length + " 个") + "\n\n";
  ids.forEach(function(id) {
    var p = null;
    PROVIDERS.forEach(function(x) { if (x.id === id) p = x; });
    if (p) msg += p.icon + " " + p.name + "\n";
  });
  alert.message = msg;
  alert.addAction("添加服务商");
  if (ids.length > 0) {
    alert.addAction("编辑配置");
    alert.addAction("删除配置");
  }
  alert.addAction("全局设置");
  alert.addCancelAction("返回");
  var idx = await alert.presentAlert();
  if (idx === 0) await showAddProviderMenu();
  if (idx === 1) await showEditMenu();
  if (idx === 2) await showDeleteMenu();
  if (idx === 3) await showGlobalSettings();
}

async function showAddProviderMenu() {
  var ids = getConfiguredIds();
  var alert = new Alert();
  alert.title = "添加服务商";
  PROVIDERS.forEach(function(p) {
    if (ids.indexOf(p.id) < 0) alert.addAction(p.icon + " " + p.name);
  });
  if (alert.actions.length === 0) {
    alert.message = "所有服务商已添加";
    alert.addCancelAction("返回");
    await alert.presentAlert();
    await showConfigMenu();
    return;
  }
  alert.addCancelAction("返回");
  var idx = await alert.presentAlert();
  if (idx === -1) { await showConfigMenu(); return; }
  var selIdx = 0;
  PROVIDERS.forEach(function(p) {
    if (ids.indexOf(p.id) < 0) {
      if (selIdx === idx) {
        // 输入 API Key
        var kAlert = new Alert();
        kAlert.title = "配置 " + p.name;
        kAlert.message = "请输入 API Key\n格式: " + p.apiKeyHint;
        kAlert.addTextField("API Key", "");
        kAlert.addAction("保存");
        kAlert.addCancelAction("取消");
        var kIdx = await kAlert.presentAlert();
        if (kIdx === 0) {
          var key = kAlert.textFieldValue(0);
          if (key && key.length > 10) {
            safeSetKeychain("api_bal_viewer_" + p.id, key);
            ids.push(p.id);
            saveConfiguredIds(ids);
          }
        }
        return;
      }
      selIdx++;
    }
  });
  await showConfigMenu();
}


// ========== 脚本入口 ==========
// iOS 16 兼容：先展示菜单，再异步查询
async function mainMenu() {
  var alert = new Alert();
  alert.title = "API 余额查看器 v6.2";
  alert.message = "选择操作";
  alert.addAction("查询余额");
  alert.addAction("配置管理");
  alert.addAction("测试通知");
  alert.addCancelAction("退出");
  var idx = await alert.presentAlert();
  if (idx === 0) { await showDashboard(); return; }
  if (idx === 1) { await showConfigMenu(); return; }
  if (idx === 2) {
    try { Notification.schedule("测试通知", "这是一条测试通知"); } catch(e) {}
    alert = new Alert();
    alert.title = "通知已发送";
    alert.message = "请检查手机通知中心";
    alert.addCancelAction("返回");
    await alert.presentAlert();
    await mainMenu();
    return;
  }
}

// Widget 支持
if (config.runsInWidget) {
  var widget = new ListWidget();
  widget.setPadding(12, 16, 12, 16);
  var titleText = widget.addText("API 余额");
  titleText.font = Font.boldSystemFont(14);
  titleText.textColor = new Color("#ffffff");
  widget.backgroundColor = new Color("#1a1a2e");
  Script.setWidget(widget);
  return;
}

// Siri 支持
if (args.widgetParameter === "silent") {
  try {
    var results = await fetchAll();
    var alerts = checkThresholds(results);
    if (alerts.length > 0) {
      Notification.schedule("余额预警", alerts.join("
"));
    }
  } catch(e) {}
  return;
}

// 正常启动：显示主菜单
await mainMenu();

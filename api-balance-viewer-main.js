// API余额查看器 远程主模块 v6.0.0
// 此文件存放在 GitHub: Chilam-Y66/scriptable-scripts
// 加载器会自动从 GitHub 拉取最新版执行

// ========== 工具函数 ==========
function pad2(n) {
  var s = String(n);
  return s.length < 2 ? '0' + s : s;
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function monthStartStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-01';
}

function fmtNum(n) {
  if (n === null || n === undefined || n !== n) return '\u2014';
  n = Number(n);
  if (n !== n) return '\u2014';
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
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

// ========== 服务商配置 ==========
var PROVIDERS = [
  { id:'deepseek',   name:'DeepSeek',   icon:'\uD83E\uDDE0', color:'#4361EE', unit:'CNY',
    apiKeyHint:'sk-...', keyExample:'sk-abc123...' },
  { id:'openai',      name:'OpenAI',      icon:'\uD83E\uDD16', color:'#10A37F', unit:'USD',
    apiKeyHint:'sk-...', keyExample:'sk-abc123...' },
  { id:'anthropic',   name:'Anthropic',   icon:'\uD83D\uDFE0', color:'#D4A574', unit:'USD',
    apiKeyHint:'sk-ant-...', keyExample:'sk-ant-abc123...' },
  { id:'aliyun',      name:'\u963F\u91CC\u4E91\u767E\u70BC', icon:'\uD83D\uDD35', color:'#FF6A00', unit:'CNY',
    apiKeyHint:'sk-...', keyExample:'sk-abc123...' },
  { id:'tencent',     name:'\u817E\u8BAF\u6DF7\u5143',    icon:'\uD83D\uDFE2', color:'#07C160', unit:'CNY',
    apiKeyHint:'SecretId::SecretKey', keyExample:'AKIDxxx::yourKey',
    note:'\u683C\u5F0F\uFF1ASecretId::SecretKey\uFF08\u53CC\u5192\u53F7\u5206\u9694\uFF09' },
  { id:'moonshot',    name:'Kimi',        icon:'\uD83C\uDF19', color:'#7B61FF', unit:'CNY',
    apiKeyHint:'sk-...', keyExample:'sk-abc123...' },
  { id:'zhipu',       name:'\u667A\u8C31 GLM',    icon:'\uD83D\uDD37', color:'#5B8FF9', unit:'CNY',
    apiKeyHint:'Bearer', keyExample:'Bearer xxx...' },
  { id:'custom',      name:'\u81EA\u5B9A\u4E49\u7AEF\u70B9',   icon:'\u2699\uFE0F', color:'#8E8E93', unit:'USD',
    apiKeyHint:'API Key', keyExample:'Bearer xxx \u6216 sk-...',
    note:'\u9700\u540C\u65F6\u586B\u5199 Base URL\uFF08\u542B/v1\uFF09' }
];

// ========== 获取已配置的服务商 ID 列表 ==========
function getConfiguredIds() {
  var raw = safeGetKeychain('api_bal_viewer_configured_ids');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch(e) { return []; }
}

function saveConfiguredIds(ids) {
  safeSetKeychain('api_bal_viewer_configured_ids', JSON.stringify(ids));
}

// ========== 获取阈值配置 ==========
function getThresholds() {
  var raw = safeGetKeychain('api_bal_viewer_thresholds');
  if (!raw) return { _global: 5 };
  try { return JSON.parse(raw); } catch(e) { return { _global: 5 }; }
}

function saveThresholds(th) {
  safeSetKeychain('api_bal_viewer_thresholds', JSON.stringify(th));
}

// ========== 查询余额 ==========
function fetchBalance(provider, apiKey) {
  return new Promise(function(resolve) {
    var url = '';
    var headers = {};

    try {
      if (provider.id === 'deepseek') {
        url = 'https://api.deepseek.com/user/balance';
        headers = { 'Authorization': 'Bearer ' + apiKey };
      } else if (provider.id === 'openai') {
        url = 'https://api.openai.com/dashboard/billing/credit_grants';
        headers = { 'Authorization': 'Bearer ' + apiKey };
      } else if (provider.id === 'anthropic') {
        resolve({ success: false, error: 'no_balance_api' });
        return;
      } else if (provider.id === 'aliyun') {
        url = 'https://dashscope.aliyuncs.com/api/v1/billing/balance';
        headers = { 'Authorization': 'Bearer ' + apiKey };
      } else if (provider.id === 'tencent') {
        resolve({ success: false, error: 'tencent_need_signature' });
        return;
      } else if (provider.id === 'moonshot') {
        url = 'https://api.moonshot.cn/v1/billing/balance';
        headers = { 'Authorization': 'Bearer ' + apiKey };
      } else if (provider.id === 'zhipu') {
        url = 'https://open.bigmodel.cn/api/paas/v4/billing/subscription';
        headers = { 'Authorization': apiKey };
      } else if (provider.id === 'custom') {
        var baseUrl = safeGetKeychain('api_bal_viewer_custom_url') || '';
        if (!baseUrl) { resolve({ success: false, error: '\u672A\u914D\u7F6E Base URL' }); return; }
        url = baseUrl.replace(/\/$/, '') + '/billing/balance';
        headers = { 'Authorization': 'Bearer ' + apiKey };
      }

      if (!url) { resolve({ success: false, error: '\u672A\u77E5\u670D\u52A1\u5546' }); return; }

      var req = new Request(url);
      req.method = 'GET';
      for (var h in headers) { req.headers[h] = headers[h]; }

      req.loadJSON().then(function(json) {
        var balance = null;
        var avail = null;
        try {
          if (provider.id === 'deepseek') { balance = json.total_balance; avail = json.total_available; }
          else if (provider.id === 'openai') { balance = json.total_available; }
          else if (provider.id === 'aliyun') { balance = json.balance; }
          else if (provider.id === 'moonshot') { balance = json.data && json.data.balance; }
          else if (provider.id === 'zhipu') { balance = json.balance; }
          else if (provider.id === 'custom') { balance = (json.data && json.data.balance) || json.balance; }
        } catch(ex) {}

        if (balance !== null && balance !== undefined) {
          resolve({ success: true, balance: String(balance), available: avail !== null ? String(avail) : null });
        } else {
          resolve({ success: false, error: '\u65E0\u6CD5\u89E3\u6790\u4F59\u989D\u6570\u636E' });
        }
      }).catch(function(err) {
        resolve({ success: false, error: String(err) });
      });
    } catch(e) {
      resolve({ success: false, error: String(e) });
    }
  });
}

// ========== 查询用量 ==========
function fetchUsage(provider, apiKey) {
  var today = todayStr();
  var monthStart = monthStartStr();

  return new Promise(function(resolve) {
    var todayTokens = null;
    var monthTokens = null;
    var todayDetail = '';
    var monthDetail = '';

    try {
      if (provider.id === 'deepseek') {
        new Request('https://api.deepseek.com/user/usage?start_date=' + monthStart + '&end_date=' + today)
          .headers = { 'Authorization': 'Bearer ' + apiKey };
        var req = new Request('https://api.deepseek.com/user/usage?start_date=' + monthStart + '&end_date=' + today);
        req.headers = { 'Authorization': 'Bearer ' + apiKey };
        req.loadJSON().then(function(json) {
          if (json && json.data) {
            var tT=0,tI=0,tO=0,mT=0,mI=0,mO=0;
            json.data.forEach(function(d) {
              var tk=(d.input_tokens||0)+(d.output_tokens||0);
              if(d.date===today){tT+=tk;tI+=(d.input_tokens||0);tO+=(d.output_tokens||0)}
              mT+=tk;mI+=(d.input_tokens||0);mO+=(d.output_tokens||0);
            });
            todayTokens=tT; monthTokens=mT;
            todayDetail='\u8F93\u5165 '+fmtNum(tI)+' / \u8F93\u51FA '+fmtNum(tO);
            monthDetail='\u8F93\u5165 '+fmtNum(mI)+' / \u8F93\u51FA '+fmtNum(mO);
          }
          resolve({todayTokens:todayTokens,monthTokens:monthTokens,todayDetail:todayDetail,monthDetail:monthDetail});
        }).catch(function(){resolve({todayTokens:null,monthTokens:null,todayDetail:'',monthDetail:''});});
        return;
      }

      if (provider.id === 'openai') {
        var req = new Request('https://api.openai.com/dashboard/billing/usage?start_date='+monthStart+'&end_date='+today);
        req.headers = { 'Authorization': 'Bearer ' + apiKey };
        req.loadJSON().then(function(json) {
          var tC=0,mC=0;
          if(json&&json.daily_costs){json.daily_costs.forEach(function(d){var ds=d.start_time?d.start_time.substring(0,10):'';var c=0;if(d.cost_data){for(var k in d.cost_data){c+=d.cost_data[k]}}mC+=c;if(ds===today)tC+=c;})}
          todayTokens=Math.round(tC*100)/100; monthTokens=Math.round(mC*100)/100;
          todayDetail='$'+String(todayTokens); monthDetail='$'+String(monthTokens);
          resolve({todayTokens:todayTokens,monthTokens:monthTokens,todayDetail:todayDetail,monthDetail:monthDetail});
        }).catch(function(){resolve({todayTokens:null,monthTokens:null,todayDetail:'',monthDetail:''});});
        return;
      }

      if (provider.id === 'anthropic') {
        var req = new Request('https://api.anthropic.com/v1/messages/count_usage');
        req.headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
        req.loadJSON().then(function(json) {
          if(json){todayTokens=(json.input_tokens||0)+(json.output_tokens||0);monthTokens=todayTokens;todayDetail=fmtNum(todayTokens)+' tokens';monthDetail=fmtNum(monthTokens)+' tokens';}
          resolve({todayTokens:todayTokens,monthTokens:monthTokens,todayDetail:todayDetail,monthDetail:monthDetail});
        }).catch(function(){resolve({todayTokens:null,monthTokens:null,todayDetail:'',monthDetail:''});});
        return;
      }

      if (provider.id === 'aliyun') {
        var req = new Request('https://dashscope.aliyuncs.com/api/v1/billing/usage?start_date='+monthStart+'&end_date='+today);
        req.headers = { 'Authorization': 'Bearer ' + apiKey };
        req.loadJSON().then(function(json) {
          if(json&&json.data){json.data.forEach(function(d){var tk=(d.input_tokens||0)+(d.output_tokens||0);if(d.date===today)todayTokens+=tk;monthTokens+=tk;})}
          resolve({todayTokens:todayTokens||null,monthTokens:monthTokens||null,todayDetail:todayTokens?fmtNum(todayTokens)+' tokens':'',monthDetail:monthTokens?fmtNum(monthTokens)+' tokens':''});
        }).catch(function(){resolve({todayTokens:null,monthTokens:null,todayDetail:'',monthDetail:''});});
        return;
      }

      if (provider.id === 'moonshot') {
        var req = new Request('https://api.moonshot.cn/v1/billing/usage?start_date='+monthStart+'&end_date='+today);
        req.headers = { 'Authorization': 'Bearer ' + apiKey };
        req.loadJSON().then(function(json) {
          if(json&&json.data){todayTokens=json.data.today_tokens||0;monthTokens=json.data.month_tokens||0;todayDetail=fmtNum(todayTokens)+' tokens';monthDetail=fmtNum(monthTokens)+' tokens';}
          resolve({todayTokens:todayTokens||null,monthTokens:monthTokens||null,todayDetail:todayDetail,monthDetail:monthDetail});
        }).catch(function(){resolve({todayTokens:null,monthTokens:null,todayDetail:'',monthDetail:''});});
        return;
      }

      if (provider.id === 'zhipu') {
        var req = new Request('https://open.bigmodel.cn/api/paas/v4/billing/usage');
        req.headers = { 'Authorization': apiKey };
        req.loadJSON().then(function(json) {
          if(json){todayTokens=json.today_tokens||null;monthTokens=json.month_tokens||null;todayDetail=todayTokens?fmtNum(todayTokens)+' tokens':'';monthDetail=monthTokens?fmtNum(monthTokens)+' tokens':'';}
          resolve({todayTokens:todayTokens,monthTokens:monthTokens,todayDetail:todayDetail,monthDetail:monthDetail});
        }).catch(function(){resolve({todayTokens:null,monthTokens:null,todayDetail:'',monthDetail:''});});
        return;
      }

      if (provider.id === 'tencent') {
        resolve({todayTokens:null,monthTokens:null,todayDetail:'\u7528\u91CF\u63A5\u53E3\u5F85\u652F\u6301',monthDetail:''});
        return;
      }

      if (provider.id === 'custom') {
        var baseUrl = safeGetKeychain('api_bal_viewer_custom_url') || '';
        if(baseUrl){var req=new Request(baseUrl.replace(/\/$/,'')+'/billing/usage');req.headers={'Authorization':'Bearer '+apiKey};req.loadJSON().then(function(json){if(json){todayTokens=json.today_tokens||null;monthTokens=json.month_tokens||null;}resolve({todayTokens:todayTokens,monthTokens:monthTokens,todayDetail:todayTokens?fmtNum(todayTokens):'',monthDetail:monthTokens?fmtNum(monthTokens):''});}).catch(function(){resolve({todayTokens:null,monthTokens:null,todayDetail:'',monthDetail:''});});return;}
      }

      resolve({todayTokens:null,monthTokens:null,todayDetail:'',monthDetail:''});
    } catch(e) {
      resolve({todayTokens:null,monthTokens:null,todayDetail:'',monthDetail:''});
    }
  });
}

// ========== 并发查询所有服务商 ==========
function fetchAll() {
  return new Promise(function(resolve) {
    var ids = getConfiguredIds();
    if (ids.length === 0) { resolve([]); return; }

    var promises = ids.map(function(id) {
      return new Promise(function(pResolve) {
        var prov = null;
        for (var i = 0; i < PROVIDERS.length; i++) { if (PROVIDERS[i].id === id) { prov = PROVIDERS[i]; break; } }
        if (!prov) { pResolve(null); return; }
        var apiKey = safeGetKeychain('api_bal_viewer_' + id);
        if (!apiKey) { pResolve(null); return; }

        fetchBalance(prov, apiKey).then(function(balResult) {
          fetchUsage(prov, apiKey).then(function(usageResult) {
            pResolve({
              id: id, provider: prov, success: balResult.success,
              balance: balResult.balance || null, available: balResult.available || null,
              unit: prov.unit, error: balResult.error || null,
              todayTokens: usageResult.todayTokens, monthTokens: usageResult.monthTokens,
              todayDetail: usageResult.todayDetail, monthDetail: usageResult.monthDetail
            });
          }).catch(function() { pResolve({id:id,provider:prov,success:balResult.success,balance:null,error:'\u7528\u91CF\u67E5\u8BE2\u5931\u8D25'}); });
        }).catch(function() { pResolve({id:id,provider:prov,success:false,balance:null,error:'\u67E5\u8BE2\u5931\u8D25'}); });
      });
    });

    Promise.all(promises).then(function(results) { resolve(results.filter(function(r){return r!==null;})); });
  });
}

// ========== 检查阈值并推送通知 ==========
function checkThresholds(results) {
  var th = getThresholds();
  results.forEach(function(r) {
    if (!r.success || !r.balance) return;
    var balNum = parseFloat(r.balance);
    if (balNum !== balNum) return;
    var threshold = th[r.id] || th['_global'] || 5;
    if (balNum <= threshold) {
      var n = new Notification();
      n.title = '\u26A0\uFE0F ' + r.provider.name + ' \u4F59\u989D\u4E0D\u8DB3';
      n.body = '\u5F53\u524D\u4F59\u989D: ' + r.balance + ' ' + r.unit + '\uFF08\u9608\u503C: ' + threshold + '\uFF09';
      n.schedule();
    }
  });
}

// ========== 显示主界面（UITable）==========
function showDashboard(results) {
  return new Promise(function(resolve) {
    var table = new UITable();
    table.name = 'API \u4F59\u989D\u67E5\u770B\u5668';

    var headerRow = new UITableRow();
    headerRow.addText(function(cell) {
      cell.title = '\uD83D\uDCCA API \u4F59\u989D\u67E5\u770B\u5668';
      cell.titleColor = new Color('#1C1C1E');
      cell.titleFont = Font.boldSystemFont(18);
    });
    table.addRow(headerRow);

    var now = new Date();
    var timeStr = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
    var timeRow = new UITableRow();
    timeRow.addText(function(cell) {
      cell.title = '\uD83D\uDD50 \u66F4\u65B0\u4E8E ' + timeStr;
      cell.titleColor = Color.gray();
      cell.titleFont = Font.systemFont(12);
    });
    table.addRow(timeRow);

    var sepRow = new UITableRow();
    sepRow.addSpacer(10);
    table.addRow(sepRow);

    if (results.length === 0) {
      var emptyRow = new UITableRow();
      emptyRow.addText(function(cell) {
        cell.title = '\u6682\u65E0\u914D\u7F6E\u7684\u670D\u52A1\u5546';
        cell.subtitle = '\u8BF7\u70B9\u51FB\u300C\u914D\u7F6E\u300D\u6DFB\u52A0';
        cell.titleColor = Color.gray();
      });
      table.addRow(emptyRow);
    } else {
      var totalCNY = 0, hasCNY = false;
      var totalUSD = 0, hasUSD = false;
      results.forEach(function(r) {
        if (!r.success || !r.balance) return;
        var b = parseFloat(r.balance);
        if (b !== b) return;
        if (r.unit === 'CNY') { totalCNY += b; hasCNY = true; }
        if (r.unit === 'USD') { totalUSD += b; hasUSD = true; }
      });

      if (hasCNY || hasUSD) {
        var totalRow = new UITableRow();
        totalRow.addText(function(cell) {
          var txt = '\u5408\u8BA1: ';
          if (hasCNY) txt += '\u00A5' + totalCNY.toFixed(2);
          if (hasCNY && hasUSD) txt += ' / ';
          if (hasUSD) txt += '$' + totalUSD.toFixed(2);
          cell.title = txt;
          cell.titleColor = new Color('#4361EE');
          cell.titleFont = Font.boldSystemFont(16);
        });
        table.addRow(totalRow);
        var sep2 = new UITableRow();
        sep2.addSpacer(10);
        table.addRow(sep2);
      }

      results.forEach(function(r) {
        var row = new UITableRow();
        var titleStr = r.provider.icon + ' ' + r.provider.name;
        var subtitleStr = '';

        if (r.success && r.balance) {
          var balNum = parseFloat(r.balance);
          var th = getThresholds();
          var threshold = th[r.id] || th['_global'] || 5;
          subtitleStr = (r.unit === 'CNY' ? '\u00A5' : '$') + r.balance;
          if (r.available) subtitleStr += '\uFF08\u53EF\u7528 ' + r.available + '\uFF09';
          if (balNum !== balNum || balNum <= threshold) subtitleStr = '\u26A0\uFE0F ' + subtitleStr + ' \u4F59\u989D\u4F4E';
        } else if (r.error === 'no_balance_api') {
          subtitleStr = '\uFF08\u65E0\u4F59\u989D\u63A5\u53E3\uFF0C\u663E\u793A\u7528\u91CF\uFF09';
        } else if (r.error) {
          subtitleStr = '\u274C ' + r.error.substring(0, 30);
        }

        var usageStr = '';
        if (r.todayTokens !== null && r.todayTokens !== undefined) {
          usageStr = '\uD83D\uDCC5\u4ECA\u65E5: ' + fmtNum(r.todayTokens);
        }
        if (r.monthTokens !== null && r.monthTokens !== undefined) {
          if (usageStr) usageStr += '  ';
          usageStr += '\uD83D\uDCC6\u672C\u6708: ' + fmtNum(r.monthTokens);
        }
        if (usageStr) subtitleStr += '\n' + usageStr;

        row.addText(function(cell) {
          cell.title = titleStr;
          cell.subtitle = subtitleStr;
          cell.titleColor = r.success ? new Color(r.provider.color) : Color.red();
          cell.titleFont = Font.boldSystemFont(14);
          cell.subtitleFont = Font.systemFont(11);
          cell.subtitleColor = Color.gray();
        });

        row.onTap = function() { refreshSingle(r.id); };
        table.addRow(row);
      });
    }

    var sep3 = new UITableRow();
    sep3.addSpacer(10);
    table.addRow(sep3);

    var refreshRow = new UITableRow();
    refreshRow.addButton(function(cell) { cell.title = '\uD83D\uDD04 \u5237\u65B0\u5168\u90E8'; });
    refreshRow.onTap = function() { mainMenu(); };
    table.addRow(refreshRow);

    var configRow = new UITableRow();
    configRow.addButton(function(cell) { cell.title = '\u2699\uFE0F \u914D\u7F6E\u670D\u52A1\u5546'; });
    configRow.onTap = function() { showConfigMenu(); };
    table.addRow(configRow);

    var notifyRow = new UITableRow();
    notifyRow.addButton(function(cell) { cell.title = '\uD83D\uDD14 \u6D4B\u8BD5\u901A\u77E5'; });
    notifyRow.onTap = function() { testNotification(); };
    table.addRow(notifyRow);

    table.present().then(function() { resolve(); }).catch(function() { resolve(); });
  });
}

// ========== 刷新单个服务商 ==========
function refreshSingle(id) {
  var prov = null;
  for (var i = 0; i < PROVIDERS.length; i++) { if (PROVIDERS[i].id === id) { prov = PROVIDERS[i]; break; } }
  if (!prov) return;
  var apiKey = safeGetKeychain('api_bal_viewer_' + id);
  if (!apiKey) return;

  var alert = new Alert();
  alert.title = '\u67E5\u8BE2\u4E2D...';
  alert.message = '\u6B63\u5728\u67E5\u8BE2 ' + prov.name + ' \u4F59\u989D...';
  alert.presentAlert();

  fetchBalance(prov, apiKey).then(function(balResult) {
    fetchUsage(prov, apiKey).then(function(usageResult) {
      showSingleResult({
        id: id, provider: prov, success: balResult.success,
        balance: balResult.balance || null, unit: prov.unit,
        error: balResult.error || null,
        todayTokens: usageResult.todayTokens, monthTokens: usageResult.monthTokens,
        todayDetail: usageResult.todayDetail, monthDetail: usageResult.monthDetail
      });
    });
  });
}

function showSingleResult(result) {
  var alert = new Alert();
  if (result.success) {
    alert.title = result.provider.icon + ' ' + result.provider.name;
    var msg = '\u4F59\u989D: ' + (result.unit === 'CNY' ? '\u00A5' : '$') + result.balance + '\n';
    if (result.available) msg += '\u53EF\u7528: ' + result.available + '\n';
    if (result.todayTokens !== null) msg += '\n\uD83D\uDCC5 \u4ECA\u65E5\u7528\u91CF: ' + fmtNum(result.todayTokens) + '\n' + result.todayDetail;
    if (result.monthTokens !== null) msg += '\n\uD83D\uDCC6 \u672C\u6708\u7528\u91CF: ' + fmtNum(result.monthTokens) + '\n' + result.monthDetail;
    alert.message = msg;
  } else {
    alert.title = '\u274C ' + result.provider.name;
    alert.message = '\u67E5\u8BE2\u5931\u8D25: ' + (result.error || '\u672A\u77E5\u9519\u8BEF');
  }
  alert.addAction('\u786E\u5B9A');
  alert.presentAlert();
}

// ========== 配置菜单 ==========
function showConfigMenu() {
  var alert = new Alert();
  alert.title = '\u2699\uFE0F \u914D\u7F6E\u670D\u52A1\u5546';
  alert.message = '\u9009\u62E9\u64CD\u4F5C';
  var ids = getConfiguredIds();
  alert.addAction('\u2795 \u6DFB\u52A0\u670D\u52A1\u5546');
  ids.forEach(function(id) {
    var prov = null;
    for (var i = 0; i < PROVIDERS.length; i++) { if (PROVIDERS[i].id === id) { prov = PROVIDERS[i]; break; } }
    if (prov) alert.addAction('\u270F\uFE0F ' + prov.name);
  });
  alert.addAction('\uD83C\uDF0D \u5168\u5C40\u8BBE\u7F6E');
  alert.addCancelAction('\u8FD4\u56DE');

  alert.presentSheet().then(function(idx) {
    if (idx === -1) { mainMenu(); return; }
    var actions = ['add'];
    ids.forEach(function(id) { actions.push(id); });
    actions.push('global');
    var action = actions[idx];
    if (action === 'add') showAddProviderMenu();
    else if (action === 'global') showGlobalSettings();
    else showEditProvider(action);
  });
}

function showAddProviderMenu() {
  var alert = new Alert();
  alert.title = '\u9009\u62E9\u670D\u52A1\u5546';
  alert.message = '\u9009\u62E9\u8981\u6DFB\u52A0\u7684\u670D\u52A1\u5546';
  var ids = getConfiguredIds();
  var available = [];
  for (var i = 0; i < PROVIDERS.length; i++) {
    if (ids.indexOf(PROVIDERS[i].id) === -1) available.push(PROVIDERS[i]);
  }

  if (available.length === 0) {
    var a = new Alert(); a.title = '\u63D0\u793A'; a.message = '\u6240\u6709\u670D\u52A1\u5546\u5DF2\u914D\u7F6E'; a.addAction('\u786E\u5B9A'); a.presentAlert(); showConfigMenu(); return;
  }

  available.forEach(function(p) { alert.addAction(p.icon + ' ' + p.name); });
  alert.addCancelAction('\u8FD4\u56DE');
  alert.presentSheet().then(function(idx) {
    if (idx === -1) { showConfigMenu(); return; }
    showProviderForm(available[idx], true);
  });
}

function showProviderForm(prov, isNew) {
  var alert = new Alert();
  alert.title = (isNew ? '\u2795 \u6DFB\u52A0 ' : '\u270F\uFE0F \u7F16\u8F91 ') + prov.name;
  alert.message = prov.note ? prov.note + '\n\nAPI Key:' : 'API Key:';
  alert.addTextField(prov.apiKeyHint, safeGetKeychain('api_bal_viewer_' + prov.id) || '');

  if (prov.id === 'custom') {
    alert.message += '\n\nBase URL\uFF08\u542B /v1\uFF09:';
    alert.addTextField('https://...', safeGetKeychain('api_bal_viewer_custom_url') || '');
  }

  alert.message += '\n\n\u9884\u8B66\u9608\u503C:';
  var th = getThresholds();
  var curTh = th[prov.id] || th['_global'] || 5;
  alert.addTextField('\u9608\u503C\uFF08\u6570\u5B57\uFF09', String(curTh));

  alert.addAction('\u4FDD\u5B58');
  if (!isNew) alert.addDestructiveAction('\u5220\u9664\u6B64\u670D\u52A1\u5546');
  alert.addCancelAction('\u53D6\u6D88');

  alert.presentAlert().then(function(idx) {
    if (idx === -1) { showConfigMenu(); return; }

    if (idx === 1 && !isNew) {
      var ids = getConfiguredIds();
      ids = ids.filter(function(x) { return x !== prov.id; });
      saveConfiguredIds(ids);
      safeRemoveKeychain('api_bal_viewer_' + prov.id);
      showConfigMenu(); return;
    }

    var apiKey = alert.textFieldValue(0);
    if (!apiKey || apiKey.trim() === '') {
      var err = new Alert(); err.title = '\u9519\u8BEF'; err.message = 'API Key \u4E0D\u80FD\u4E3A\u7A7A'; err.addAction('\u786E\u5B9A'); err.presentAlert(); showConfigMenu(); return;
    }

    safeSetKeychain('api_bal_viewer_' + prov.id, apiKey.trim());

    if (prov.id === 'custom') {
      var baseUrl = alert.textFieldValue(1);
      if (baseUrl) safeSetKeychain('api_bal_viewer_custom_url', baseUrl.trim());
    }

    var thVal = parseFloat(alert.textFieldValue(prov.id === 'custom' ? 2 : 1));
    if (thVal === thVal) { th[prov.id] = thVal; saveThresholds(th); }

    var ids2 = getConfiguredIds();
    if (ids2.indexOf(prov.id) === -1) { ids2.push(prov.id); saveConfiguredIds(ids2); }

    var success = new Alert(); success.title = '\u2705 \u4FDD\u5B58\u6210\u529F'; success.message = prov.name + ' \u5DF2\u4FDD\u5B58'; success.addAction('\u786E\u5B9A');
    success.presentAlert().then(function() { showConfigMenu(); });
  });
}

function showEditProvider(id) {
  var prov = null;
  for (var i = 0; i < PROVIDERS.length; i++) { if (PROVIDERS[i].id === id) { prov = PROVIDERS[i]; break; } }
  if (prov) showProviderForm(prov, false);
}

function showGlobalSettings() {
  var th = getThresholds();
  var alert = new Alert();
  alert.title = '\uD83C\uDF0D \u5168\u5C40\u8BBE\u7F6E';
  alert.message = '\u5168\u5C40\u9884\u8B66\u9608\u503C:\n\n\u5F53\u524D: ' + (th['_global'] || 5);
  alert.addTextField('\u5168\u5C40\u9608\u503C', String(th['_global'] || 5));
  alert.addAction('\u4FDD\u5B58');
  alert.addCancelAction('\u8FD4\u56DE');
  alert.presentAlert().then(function(idx) {
    if (idx === -1) { showConfigMenu(); return; }
    var val = parseFloat(alert.textFieldValue(0));
    if (val === val) { th['_global'] = val; saveThresholds(th); var a = new Alert(); a.title = '\u2705 \u5DF2\u4FDD\u5B58'; a.message = '\u5168\u5C40\u9608\u503C: ' + val; a.addAction('\u786E\u5B9A'); a.presentAlert().then(function(){showConfigMenu();}); }
    else showConfigMenu();
  });
}

// ========== 测试通知 ==========
function testNotification() {
  var n = new Notification();
  n.title = '\uD83D\uDD14 API\u4F59\u989D\u67E5\u770B\u5668';
  n.body = '\u901A\u77E5\u529F\u80FD\u6B63\u5E38\uFF01\u5F53\u4F59\u989D\u4F4E\u4E8E\u9608\u503C\u65F6\u4F1A\u6536\u5230\u6B64\u901A\u77E5\u3002';
  n.schedule();
  var a = new Alert(); a.title = '\u2705 \u901A\u77E5\u5DF2\u53D1\u9001'; a.message = '\u8BF7\u68C0\u67E5 iPhone \u901A\u77E5\u4E2D\u5FC3'; a.addAction('\u786E\u5B9A'); a.presentAlert();
}

// ========== Widget 小组件 ==========
function buildWidget(results) {
  var w = new ListWidget();
  w.setPadding(12, 14, 12, 14);
  var th = getThresholds();
  var hasLow = false;

  results.forEach(function(r) {
    if (!r.success || !r.balance) return;
    var balNum = parseFloat(r.balance);
    if (balNum !== balNum) return;
    var threshold = th[r.id] || th['_global'] || 5;
    if (balNum <= threshold) hasLow = true;
  });
  w.backgroundColor = hasLow ? new Color('#FFF0F0') : new Color('#F2F2F7');

  var titleTxt = w.addText('API \u4F59\u989D');
  titleTxt.font = Font.boldSystemFont(13);
  titleTxt.textColor = new Color('#8E8E93');
  w.addSpacer(6);

  if (results.length === 0) {
    var noTxt = w.addText('\u6682\u65E0\u6570\u636E\n\u70B9\u51FB\u914D\u7F6E\u670D\u52A1\u5546');
    noTxt.font = Font.systemFont(11);
    noTxt.textColor = Color.gray();
    return w;
  }

  var family = config && config.widgetFamily ? config.widgetFamily : 'medium';

  results.forEach(function(r) {
    if (family === 'small' && r !== results[0]) return;
    var row = w.addStack();
    row.layoutHorizontally();
    var nameTxt = row.addText(r.provider.icon + ' ' + r.provider.name);
    nameTxt.font = Font.systemFont(11);
    nameTxt.textColor = new Color(r.provider.color);
    row.addSpacer();

    if (r.success && r.balance) {
      var balNum = parseFloat(r.balance);
      var threshold = th[r.id] || th['_global'] || 5;
      var isLow = (balNum === balNum && balNum <= threshold);
      var balTxt = row.addText((r.unit === 'CNY' ? '\u00A5' : '$') + r.balance);
      balTxt.font = Font.boldSystemFont(12);
      balTxt.textColor = isLow ? Color.red() : new Color('#1C1C1E');
    } else {
      var errTxt = row.addText('\u5F02\u5E38');
      errTxt.font = Font.systemFont(11);
      errTxt.textColor = Color.red();
    }
    w.addSpacer(4);
  });

  if (family !== 'small') {
    results.forEach(function(r) {
      if (r.todayTokens !== null) {
        var uRow = w.addStack(); uRow.layoutHorizontally();
        var uTxt = uRow.addText('\uD83D\uDCC5' + r.provider.name.substring(0,4) + ' \u4ECA\u65E5: ' + fmtNum(r.todayTokens));
        uTxt.font = Font.systemFont(10); uTxt.textColor = Color.gray();
        w.addSpacer(2);
      }
    });
  }

  if (family === 'large') {
    w.addSpacer(6);
    var sep = w.addText('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
    sep.font = Font.systemFont(10); sep.textColor = new Color('#E5E5EA');
    w.addSpacer(4);
    results.forEach(function(r) {
      if (r.monthTokens !== null) {
        var mRow = w.addStack(); mRow.layoutHorizontally();
        var mTxt = mRow.addText('\uD83D\uDCC6 ' + r.provider.name + ' \u672C\u6708: ' + fmtNum(r.monthTokens));
        mTxt.font = Font.systemFont(10); mTxt.textColor = Color.gray();
        w.addSpacer(2);
      }
    });
  }

  w.addSpacer(4);
  var now = new Date();
  var timeTxt = w.addText(pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ' \u66F4\u65B0');
  timeTxt.font = Font.systemFont(10);
  timeTxt.textColor = new Color('#AEAEB2');
  return w;
}

// ========== 带超时的 fetchAll ==========
function fetchAllWithTimeout(timeoutMs) {
  return new Promise(function(resolve) {
    var done = false;
    var timer = setTimeout(function() {
      if (!done) { done = true; resolve({ timedOut: true, results: [] }); }
    }, timeoutMs);
    fetchAll().then(function(results) {
      if (!done) { done = true; clearTimeout(timer); resolve({ timedOut: false, results: results }); }
    }).catch(function(err) {
      if (!done) { done = true; clearTimeout(timer); resolve({ timedOut: false, results: [], error: String(err) }); }
    });
  });
}

// ========== 主菜单 ==========
function mainMenu() {
  fetchAllWithTimeout(15000).then(function(res) {
    if (res.timedOut) {
      var a = new Alert();
      a.title = '\u23F1 查询超时';
      a.message = '网络请求超时（15秒），请检查网络后重试';
      a.addAction('重试');
      a.addCancelAction('退出');
      a.presentAlert().then(function(idx) { if (idx === 0) mainMenu(); });
      return;
    }
    if (res.error) {
      var a = new Alert();
      a.title = '\u274C 查询出错';
      a.message = res.error;
      a.addAction('重试');
      a.addCancelAction('退出');
      a.presentAlert().then(function(idx) { if (idx === 0) mainMenu(); });
      return;
    }
    checkThresholds(res.results);
    showDashboard(res.results);
  });
}

// ========== 导出的 main 函数（供加载器调用）==========
module.exports = {
  main: async function() {
    if (config && config.widgetFamily) {
      var results = await fetchAll();
      var w = buildWidget(results);
      Script.setWidget(w);
      Script.complete();
      return;
    }
    if (args && args.widgetParameter === 'silent') {
      var results = await fetchAll();
      checkThresholds(results);
      Script.complete();
      return;
    }
    var ids = getConfiguredIds();
    if (ids.length === 0) {
      var welcome = new Alert();
      welcome.title = '\uD83D\uDCCA API \u4F59\u989D\u67E5\u770B\u5668';
      welcome.message = '\u6B22\u8FCE\u4F7F\u7528\uFF01\n\n\u8BF7\u5148\u914D\u7F6E\u8981\u67E5\u8BE2\u7684\u670D\u52A1\u5546';
      welcome.addAction('\u5F00\u59CB\u914D\u7F6E');
      welcome.addCancelAction('\u9000\u51FA');
      await welcome.presentAlert();
      showConfigMenu();
    } else {
      mainMenu();
    }
  }
};

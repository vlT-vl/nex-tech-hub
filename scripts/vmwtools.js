// vmwtools.js <> modulo js per conversione rvtools.xlsx in json
//------------------------------------------------------------------------------
// developed by Veronesi Lorenzo
//------------------------------------------------------------------------------

import * as XLSX from 'xlsx';

// ─── module constants ─────────────────────────────────────────────────────────
const VMWTOOLS_VERSION = '0.1.0';
const VMWTOOLS_BUILD = 'R080726';
const RVTOOLS_VERSION = '4.0';
const EXCEL_UNIX_EPOCH_SERIAL = 25569;
const MS_PER_DAY = 86400 * 1000;

const DEFAULT_OPTIONS = {
  strictSheets: true,
  strictVersion: true,
  includeRawSheets: false,
  minRvtoolsVersion: RVTOOLS_VERSION
};

const REQUIRED_SHEETS = [
  'vInfo', 'vCPU', 'vMemory', 'vDisk', 'vPartition', 'vNetwork', 'vCD', 'vUSB', 'vSnapshot',
  'vTools', 'vSource', 'vRP', 'vCluster', 'vHost', 'vHBA', 'vNIC', 'vSwitch', 'vPort', 'dvSwitch',
  'dvPort', 'vSC_VMK', 'vDatastore', 'vMultiPath', 'vLicense', 'vFileInfo', 'vHealth', 'vMetaData'
];

const INFRA_MARGIN_MULTIPLIERS = {
  plus10: 1.10,
  plus20: 1.20,
  plus30: 1.30
};

const VM_NAME_KEYS = ['VM', 'Vm', 'vm'];
const VM_ID_KEYS = ['VM ID', 'Vm ID', 'vm_id', 'VMID'];
const SNAPSHOT_NAME_KEYS = ['Name', 'Snapshot Name', 'name'];
const SNAPSHOT_DATE_KEYS = ['Date / time', 'Date/Time', 'date_time'];
const SNAPSHOT_DESCRIPTION_KEYS = ['Description', 'description'];
const PRIMARY_DISK_LABEL_KEYS = ['Hard disk', 'Hard Disk', 'Disk', 'disk'];
const PRIMARY_DISK_UNIT_KEYS = ['Unit Number', 'Unit number', 'unit_number', 'UnitNumber'];
const PRIMARY_DISK_CAPACITY_KEYS = [
  'Capacity MiB', 'CapacityMiB', 'Capacity MB', 'CapacityMB',
  'Max Size MiB', 'Provisioned MiB', 'capacity_mib', 'Capacity'
];

// ─── public parser ────────────────────────────────────────────────────────────
export default async function vmwtools(input, options = {}) {
  // Local constants and mutable state.
  const config = { ...DEFAULT_OPTIONS, ...options };
  const issues = { warnings: [], errors: [] };

  // Workbook input and raw sheet extraction.
  const data = await normalizeInput(input);
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetNames = workbook.SheetNames || [];
  const missingSheets = REQUIRED_SHEETS.filter(name => !sheetNames.includes(name));

  if (missingSheets.length > 0) {
    const msg = `Formato RVTools incompleto. Mancano i fogli: ${missingSheets.join(', ')}`;
    if (config.strictSheets) throw new Error(msg);
    issues.warnings.push({ code: 'MISSING_SHEETS', message: msg, missingSheets });
  }

  const sheets = {};
  for (const sheetName of sheetNames) {
    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: true });
  }

  // RVTools sheets used by the current vmwtools schema.
  const {
    vInfo = [],
    vHost = [],
    vDisk = [],
    vDatastore = [],
    vCluster = [],
    vLicense = [],
    vPort = [],
    dvPort = [],
    vMetaData = [],
    vSnapshot = []
  } = sheets;

  // Report metadata and validation.
  const rvMeta = extractRvMeta(vMetaData);
  validateRvtoolsVersion(rvMeta.majorVersion, config.minRvtoolsVersion, config.strictVersion, issues);

  // Source-level context.
  const general = extractGeneralInfo(vInfo, vHost);
  const scope = detectScope(vHost, vCluster);
  const reportName = buildReportName(general.endpoint, rvMeta.capturedAtCompact);

  // Shared indexes and normalized collections.
  const uniqueDatastores = uniqueBy(vDatastore, 'Name');
  const datastoresByHost = buildDatastoresByHostMap(vDatastore);
  const hostsByCluster = buildHostsByClusterMap(vHost);
  const primaryDiskIndex = buildPrimaryDiskIndex(vDisk);

  // Calculated output blocks.
  const vmTable = buildVmTable(vInfo, vSnapshot, primaryDiskIndex);
  const portGroups = buildPortGroups(vPort, dvPort);
  const inventoryCounts = buildInventoryCounts(vInfo, vHost, uniqueDatastores, vLicense, portGroups, vCluster);
  const compute = buildInfrastructureCompute(vmTable, vHost, uniqueDatastores);
  const margin = buildInfrastructureMargin(compute.used);
  const osCounts = buildOsCounts(vmTable);
  const osComputeOn = buildOsTotals(vmTable);
  const clusterDetails = buildClusterDetails(vHost, vCluster, hostsByCluster, datastoresByHost);
  const nodes = buildNodes(vHost, datastoresByHost);
  const storages = buildStorages(uniqueDatastores);
  const licenses = buildLicenseList(vLicense);
  const datacenter = buildDatacenterBlock({ scope, general, compute });
  const report = {
    captured_at: rvMeta.capturedAtDisplay || 'N/D',
    name: reportName
  };

  return {
    vmwtools: `version ${VMWTOOLS_VERSION} - build: ${VMWTOOLS_BUILD}`,
    report,
    source: {
      version: rvMeta.majorVersion || 'unknown',
      supported: compareVersions(rvMeta.majorVersion || '0.0.0', config.minRvtoolsVersion) >= 0,
      endpoint: general.endpoint,
      workbook_sheets: sheetNames,
      missing_required_sheets: missingSheets
    },
    datacenter,
    clusters: clusterDetails,
    nodes,
    vm: vmTable,
    storages,
    network: {
      total_portgroups: portGroups.length,
      portgroups: portGroups
    },
    licenses,
    summary: {
      inventory: inventoryCounts,
      compute,
      os: osCounts,
      os_compute_on: osComputeOn,
      margin
    },
    issues,
    raw: config.includeRawSheets ? sheets : undefined
  };
}

// ─── input and validation ─────────────────────────────────────────────────────
async function normalizeInput(input) {
  if (!input) throw new Error('Input mancante');

  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);

  if (typeof Buffer !== 'undefined' && input instanceof Buffer) {
    return new Uint8Array(input);
  }

  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }

  throw new Error('Tipo input non supportato. Usa File, Blob, Buffer, Uint8Array o ArrayBuffer');
}

// ─── metadata extraction ──────────────────────────────────────────────────────
function extractRvMeta(vMetaData) {
  const meta = vMetaData[0] || {};
  const majorVersion = cleanVersion(meta['RVTools major version']);
  const excelSerial = num(meta['xlsx creation datetime']);
  const capturedDate = excelSerialToDate(excelSerial);

  let capturedAt = null;
  let capturedAtDisplay = null;
  let capturedAtCompact = null;

  if (capturedDate) {
    const p = getUtcDateTimeParts(capturedDate);

    capturedAt = capturedDate.toISOString();
    capturedAtDisplay = `${p.d}-${p.m}-${p.y} ${p.hh}:${p.mm}:${p.ss}`;
    capturedAtCompact = `${p.y}${p.m}${p.d}-${p.hh}${p.mm}${p.ss}`;
  }

  return {
    majorVersion,
    excelSerial,
    capturedAt,
    capturedAtDisplay,
    capturedAtCompact
  };
}

function validateRvtoolsVersion(version, minVersion, strict, issues) {
  if (!version) {
    const msg = 'Versione RVTools non rilevata dal foglio vMetaData';
    if (strict) throw new Error(msg);
    issues.warnings.push({ code: 'RVTOOLS_VERSION_NOT_FOUND', message: msg });
    return;
  }

  if (compareVersions(version, minVersion) < 0) {
    const msg = `Versione RVTools non supportata: ${version}. Minima richiesta: ${minVersion}`;
    if (strict) throw new Error(msg);
    issues.errors.push({ code: 'UNSUPPORTED_RVTOOLS_VERSION', message: msg, version, minVersion });
  }
}

function extractGeneralInfo(vInfo, vHost) {
  const endpoint = vInfo[0]?.['VI SDK Server'] || 'N/D';
  const versione = vInfo[0]?.['VI SDK API Version'] || 'N/D';
  const build = (vInfo[0]?.['VI SDK Server type'] || '').split('build-')[1] || 'N/D';
  const tipologia = hasClusters(vHost) ? 'vCenter' : 'ESXi';

  return {
    endpoint,
    versione,
    build,
    tipologia
  };
}

function detectScope(vHost, vCluster) {
  const clusterNames = uniqueValues(vHost, h => h.Cluster);

  if (clusterNames.length === 1) return makeScope('cluster', clusterNames[0]);
  if (clusterNames.length > 1) return makeScope('cluster', 'multi-cluster', 'multi-cluster');

  const standaloneHosts = uniqueValues(vHost, h => h.Host);
  if (standaloneHosts.length === 1) return makeScope('standalone', standaloneHosts[0]);
  if (standaloneHosts.length > 1) return makeScope('standalone', 'multi-host', 'multi-host');

  const fallback = vCluster[0]?.Name || 'unknown-scope';
  return makeScope('unknown', fallback);
}

function makeScope(type, displayName, name = sanitizeName(displayName)) {
  return {
    type,
    name,
    display_name: displayName
  };
}

function buildReportName(scopeName, capturedAtCompact) {
  return `report-vmwtools-${sanitizeName(scopeName || 'unknown-scope')}-${capturedAtCompact || 'unknown-date'}.json`;
}

// ─── top-level output builders ────────────────────────────────────────────────
function buildDatacenterBlock({ scope, general, compute }) {
  return {
    type: scope.type,
    endpoint: general.endpoint,
    version: {
      version: general.versione,
      build: general.build
    },
    resources: {
      cpu: {
        vcpu_total: compute.total.vcpus,
        vcpu_used: compute.used.vcpus,
        vcpu_free: compute.free.vcpus,
        ghz_total: compute.total.ghz,
        ghz_used: compute.used.ghz,
        ghz_free: compute.free.ghz,
        percentage: pct(compute.used.ghz, compute.total.ghz)
      },
      ram: {
        total_gib: compute.total.ramGiB,
        used_gib: compute.used.ramGiB,
        free_gib: compute.free.ramGiB,
        total: compute.total.ramDisplay,
        used: compute.used.ramDisplay,
        free: compute.free.ramDisplay,
        percentage: pct(compute.used.ramGiB, compute.total.ramGiB)
      },
      storage: {
        total_gib: compute.total.storageGiB,
        used_gib: compute.used.storageGiB,
        free_gib: compute.free.storageGiB,
        total: compute.total.storageDisplay,
        used: compute.used.storageDisplay,
        free: compute.free.storageDisplay,
        percentage: pct(compute.used.storageGiB, compute.total.storageGiB)
      }
    }
  };
}

function buildInventoryCounts(vInfo, vHost, uniqueDatastores, vLicense, portGroups, vCluster) {
  const vmTotal = vInfo.length;
  const poweredOnVMs = vInfo.filter(vm => vm.Powerstate === 'poweredOn').length;
  const poweredOffVMs = vInfo.filter(vm => vm.Powerstate === 'poweredOff').length;
  const hostTotal = vHost.length;
  const datastoreTotal = uniqueDatastores.length;
  const licensesTotal = vLicense.length;
  const networkTotal = portGroups.length;
  const totalCluster = uniqueValues(vHost, h => h.Cluster).length || vCluster.length;

  return {
    vm_total: vmTotal,
    vm_powered_on: poweredOnVMs,
    vm_powered_off: poweredOffVMs,
    host_total: hostTotal,
    datastore_total: datastoreTotal,
    licenses_total: licensesTotal,
    network_total: networkTotal,
    cluster_total: totalCluster
  };
}

// ─── VM table builders ────────────────────────────────────────────────────────
function pick(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function norm(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function toSnapshotDate(value) {
  if (value === null || value === undefined || value === '') return '—';
  const dt = value instanceof Date ? value : excelSerialToDate(value);
  if (dt && !Number.isNaN(dt.getTime())) return formatDateObj(dt);

  return norm(value) || '—';
}

function formatDateObj(dt) {
  return [
    `${dt.getFullYear()}/${pad2(dt.getMonth() + 1)}/${pad2(dt.getDate())}`,
    `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`
  ].join(' ');
}

function getUtcDateTimeParts(dt) {
  return {
    y: dt.getUTCFullYear(),
    m: pad2(dt.getUTCMonth() + 1),
    d: pad2(dt.getUTCDate()),
    hh: pad2(dt.getUTCHours()),
    mm: pad2(dt.getUTCMinutes()),
    ss: pad2(dt.getUTCSeconds())
  };
}

function buildSnapshotIndex(vSnapshot = []) {
  return vSnapshot.reduce((acc, row) => {
    const vmName = norm(pick(row, VM_NAME_KEYS));
    const vmId = norm(pick(row, VM_ID_KEYS));
    const snapshotName = norm(pick(row, SNAPSHOT_NAME_KEYS));

    if (!snapshotName || (!vmName && !vmId)) return acc;

    const snapshot = {
      name: snapshotName,
      date_time: toSnapshotDate(pick(row, SNAPSHOT_DATE_KEYS)),
      description: norm(pick(row, SNAPSHOT_DESCRIPTION_KEYS)) || '—'
    };

    pushObjectList(acc.byId, vmId, snapshot);
    pushObjectList(acc.byName, vmName, snapshot);

    return acc;
  }, { byId: {}, byName: {} });
}

function buildPrimaryDiskIndex(vDisk) {
  const index = {};
  for (const row of vDisk) {
    const vmName = norm(pick(row, VM_NAME_KEYS));
    if (!vmName) continue;

    // RVTools column "Hard disk" contains values like "Hard disk 1", "Hard disk 2"
    // Some versions use "Disk" or a numeric Unit Number column
    const diskLabel = norm(pick(row, PRIMARY_DISK_LABEL_KEYS)).toLowerCase();
    const unitNum   = pick(row, PRIMARY_DISK_UNIT_KEYS);

    // Accept as primary disk: "Hard disk 1" | "disk 1" | unit 0 or 1 (controller slot)
    const isPrimary =
      diskLabel.endsWith('1') ||
      diskLabel === 'hard disk 1' ||
      String(unitNum) === '0' ||
      String(unitNum) === '1';

    if (!isPrimary) continue;
    if (index[vmName] !== undefined) continue;

    const capMiB = num(pick(row, PRIMARY_DISK_CAPACITY_KEYS));
    if (!capMiB) continue;
    index[vmName] = +(capMiB / 1024).toFixed(2);
  }
  return index;
}

function buildVmTable(vInfo, vSnapshot = [], primaryDiskIndex = {}) {
  const snapshotIndex = buildSnapshotIndex(vSnapshot);

  return vInfo.map(vm => {
    const memoryMiB = num(vm.Memory);
    const usedGiB = num(vm['In Use MiB']) / 1024;

    const primaryDatastore = (vm.Path?.match(/^\[([^\]]+)\]/) || [])[1] || '—';
    const resourcePoolRaw = vm['Resource pool'] || vm['Resource Pool'] || '—';
    const folderRaw = vm.Folder || vm.folder || '—';

    const vmName = norm(pick(vm, VM_NAME_KEYS));
    const vmId = norm(pick(vm, VM_ID_KEYS));

    const snapshots =
      (vmId && snapshotIndex.byId[vmId]) ||
      (vmName && snapshotIndex.byName[vmName]) ||
      [];

    const primaryDiskGib = primaryDiskIndex[vmName] ?? null;

    return {
      name: vmName || '—',
      vcpus: int(vm.CPUs),
      vram_gib: +(memoryMiB / 1024).toFixed(2),
      vram: memoryMiB >= 1024 ? `${Math.round(memoryMiB / 1024)} GiB` : `${Math.round(memoryMiB)} MiB`,
      vdisks: int(vm.Disks),
      storage_gib: +usedGiB.toFixed(2),
      storage: formatGiB(usedGiB),
      primary_disk_gib: primaryDiskGib,
      host: vm.Host || '—',
      primary_datastore: primaryDatastore,
      primary_ipaddress: vm['Primary IP Address'] || '—',
      primary_network: vm['Network #1'] || '—',
      os_config: vm['OS according to the configuration file'] || '—',
      vm_id: vm['VM ID'] || '—',
      state: vm.Powerstate || '—',
      uptime_days: calcVmUptimeDays(vm),
      resource_pool: parseResourcePoolPath(resourcePoolRaw),
      folder: parseFolderPath(folderRaw),
      snapshots,
      snapshots_count: snapshots.length
    };
  });
}

// ─── compute and margin builders ──────────────────────────────────────────────
function buildInfrastructureCompute(vmTable, vHost, uniqueDatastores) {
  let totalVcpus = 0;
  let usedVcpus = 0;

  for (const vm of vmTable) {
    totalVcpus += vm.vcpus;
    if (vm.state === 'poweredOn') usedVcpus += vm.vcpus;
  }

  let totalGhz = 0;
  let usedGhz = 0;
  let totalCores = 0;
  let totalRam = 0;
  let usedRam = 0;

  for (const h of vHost) {
    const speed = num(h.Speed);
    const cores = int(h['# Cores']);
    const memoryMiB = num(h['# Memory']);
    const cpuUsage = num(h['CPU usage %']);
    const memUsage = num(h['Memory usage %']);

    const hostGHz = (speed * cores) / 1000;
    totalGhz += hostGHz;
    usedGhz += hostGHz * (cpuUsage / 100);
    totalCores += cores;
    totalRam += memoryMiB / 1024;
    usedRam += (memoryMiB * (memUsage / 100)) / 1024;
  }

  const totalStorage = sumDatastoreCapacityGiB(uniqueDatastores);

  let usedStorage = 0;
  for (const vm of vmTable) usedStorage += vm.storage_gib;

  const freeVcpus = totalVcpus - usedVcpus;
  const freeGhz = totalGhz - usedGhz;
  const freeRam = totalRam - usedRam;
  const freeStorage = totalStorage - usedStorage;

  return {
    total: buildComputeResourceBlock(totalVcpus, totalGhz, totalRam, totalStorage, totalCores),
    used: buildComputeResourceBlock(usedVcpus, usedGhz, usedRam, usedStorage),
    free: buildComputeResourceBlock(freeVcpus, freeGhz, freeRam, freeStorage)
  };
}

function buildComputeResourceBlock(vcpus, ghz, ramGiB, storageGiB, cores) {
  const block = {
    vcpus,
    ghz: round2(ghz),
    ghzDisplay: formatGHz(ghz)
  };

  if (cores !== undefined) block.cores = cores;

  return {
    ...block,
    ramGiB: round2(ramGiB),
    ramDisplay: formatGiB(ramGiB),
    storageGiB: round2(storageGiB),
    storageDisplay: formatGiB(storageGiB)
  };
}

function buildInfrastructureMargin(used) {
  return Object.fromEntries(
    Object.entries(INFRA_MARGIN_MULTIPLIERS)
      .map(([key, multiplier]) => [key, buildMarginBlock(used, multiplier)])
  );
}

function buildMarginBlock(used, multiplier) {
  const ghz = used.ghz * multiplier;
  const ram = used.ramGiB * multiplier;
  const storage = used.storageGiB * multiplier;

  return {
    vcpus: round2(used.vcpus * multiplier),
    ghz: round2(ghz),
    ghzDisplay: formatGHz(ghz),
    ramGiB: round2(ram),
    ramDisplay: formatGiB(ram),
    storageGiB: round2(storage),
    storageDisplay: formatGiB(storage)
  };
}

function buildOsCounts(vmTable) {
  const counts = { windows: 0, linux: 0, other: 0 };

  for (const vm of vmTable) {
    const kind = detectOsKind(vm.os_config);
    counts[kind]++;
  }

  return counts;
}

function buildOsTotals(vmTable) {
  const totals = {
    windows: { vcpus: 0, vramGiB: 0, storageGiB: 0, count: 0 },
    linux: { vcpus: 0, vramGiB: 0, storageGiB: 0, count: 0 },
    other: { vcpus: 0, vramGiB: 0, storageGiB: 0, count: 0 }
  };

  for (const vm of vmTable) {
    if (String(vm.state).toLowerCase() !== 'poweredon') continue;

    const kind = detectOsKind(vm.os_config);
    totals[kind].vcpus += int(vm.vcpus);
    totals[kind].vramGiB += num(vm.vram_gib);
    totals[kind].storageGiB += num(vm.storage_gib);
    totals[kind].count++;
  }

  for (const key of Object.keys(totals)) {
    totals[key].vramGiB = round2(totals[key].vramGiB);
    totals[key].vram = formatGiB(totals[key].vramGiB);
    totals[key].storageGiB = round2(totals[key].storageGiB);
    totals[key].storage = formatGiB(totals[key].storageGiB);
  }

  return totals;
}

// ─── maps and infrastructure collection builders ──────────────────────────────
function buildHostsByClusterMap(vHost) {
  const map = new Map();

  for (const h of vHost) {
    pushMapValue(map, h.Cluster || '__standalone__', h);
  }

  return map;
}

function buildDatastoresByHostMap(vDatastore) {
  const map = new Map();

  for (const ds of vDatastore) {
    const hosts = String(ds.Hosts || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);

    for (const host of hosts) {
      pushMapValue(map, host, ds);
    }
  }

  return map;
}

function pushMapValue(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function pushObjectList(object, key, value) {
  if (!key) return;
  if (!object[key]) object[key] = [];
  object[key].push(value);
}

function getHostDatastores(hostname, datastoresByHost) {
  return datastoresByHost.get(hostname) || [];
}

function sumDatastoreCapacityGiB(datastores) {
  let total = 0;
  for (const ds of datastores) total += parseMiB(ds['Capacity MiB']) / 1024;
  return total;
}

function getHostMetrics(host, datastoresByHost) {
  const speed = num(host.Speed);
  const cores = int(host['# Cores']);
  const ramGiB = num(host['# Memory']) / 1024;
  const datastores = getHostDatastores(host.Host, datastoresByHost);
  const bootDate = excelSerialToDate(host['Boot time'], false, -Infinity);
  const [version, build] = String(host['ESX Version'] || '').split('build-');

  return {
    cores,
    ramGiB,
    ghz: (speed * cores) / 1000,
    storageGiB: sumDatastoreCapacityGiB(datastores),
    vmUsedMemGiB: num(host['vRAM']) / 1024,
    uptimeDays: daysSinceDate(bootDate),
    datastores,
    version: (version || 'N/D').trim(),
    build: build || 'N/D'
  };
}

function buildClusterDetails(vHost, vCluster, hostsByCluster, datastoresByHost) {
  const clusterNames = uniqueValues(vHost, h => h.Cluster);

  return clusterNames.map(name => {
    const hosts = hostsByCluster.get(name) || [];
    const conf = vCluster.find(c => c.Name === name) || {};

    let totalGhz = 0;
    let totalRamGiB = 0;
    const dsMap = new Map();

    const hostsDetails = hosts.map(h => {
      const metrics = getHostMetrics(h, datastoresByHost);

      for (const ds of metrics.datastores) {
        if (ds.Name) dsMap.set(ds.Name, ds);
      }

      totalGhz += metrics.ghz;
      totalRamGiB += metrics.ramGiB;

      return {
        hostname: h.Host || '—',
        vendor: h.Vendor || '—',
        model: h.Model || '—',
        processor: h['CPU Model'] || '—',
        ram_gib: round2(metrics.ramGiB),
        ram: formatGiB(metrics.ramGiB),
        storage_gib: round2(metrics.storageGiB),
        storage: formatGiB(metrics.storageGiB),
        uptime_days: metrics.uptimeDays,
        version: metrics.version,
        build: metrics.build,
        vcpu: int(h['# vCPUs']),
        ghz: round2(metrics.ghz),
        ghz_display: formatGHz(metrics.ghz),
        cpu_core: metrics.cores,
        vm_number: int(h['# VMs']),
        vm_used_mem_gib: round2(metrics.vmUsedMemGiB),
        vm_used_mem: formatGiB(metrics.vmUsedMemGiB),
        maintenance: h['in Maintenance Mode'] ?? 'N/D',
        service_tag: h['Service tag'] || '—'
      };
    });

    const totalStorageGiB = sumDatastoreCapacityGiB(dsMap.values());

    return {
      name,
      configured_nodes: hosts.length,
      ha: conf['HA enabled'] ?? conf['HA Enabled'] ?? 'N/D',
      drs: conf['DRS enabled'] ?? conf['DRS Enabled'] ?? 'N/D',
      resources: {
        cpu: {
          ghz_total: round2(totalGhz),
          ghz_display: formatGHz(totalGhz)
        },
        ram: {
          total_gib: round2(totalRamGiB),
          total: formatGiB(totalRamGiB)
        },
        storage: {
          total_gib: round2(totalStorageGiB),
          total: formatGiB(totalStorageGiB)
        }
      },
      nodes: hostsDetails
    };
  });
}

function buildNodes(vHost, datastoresByHost) {
  return vHost.map(h => {
    const metrics = getHostMetrics(h, datastoresByHost);

    return {
      name: h.Host || '—',
      cluster: h.Cluster || 'Standalone ESXi',
      vendor: h.Vendor || '—',
      version: metrics.version,
      build: metrics.build,
      model: h.Model || '—',
      service_tag: h['Service tag'] || '—',
      processor: normalizeProcessor(h['CPU Model']),
      maintenance: h['in Maintenance Mode'] ?? 'N/D',
      objectid: h['Object ID'] ?? 'N/D',
      uuid: h['UUID'] ?? 'N/D',
      uptime_days: metrics.uptimeDays,
      resources: {
        cpu: {
          vcpu: int(h['# vCPUs']),
          cores: metrics.cores,
          ghz: round2(metrics.ghz),
          ghz_display: formatGHz(metrics.ghz)
        },
        ram: {
          total_gib: round2(metrics.ramGiB),
          total: formatGiB(metrics.ramGiB),
          vm_used_gib: round2(metrics.vmUsedMemGiB),
          vm_used: formatGiB(metrics.vmUsedMemGiB)
        },
        storage: {
          total_gib: round2(metrics.storageGiB),
          total: formatGiB(metrics.storageGiB)
        }
      },
      vm_number: int(h['# VMs'])
    };
  });
}

function buildStorages(uniqueDatastores) {
  return uniqueDatastores.map(ds => {
    const cap = parseMiB(ds['Capacity MiB']);
    const used = parseMiB(ds['In Use MiB']);
    const free = parseMiB(ds['Free MiB']) || (cap - used);

    return {
      name: ds.Name || '—',
      type: ds.Type || '—',
      major_version: ds['Major Version'] || '—',
      vm_count: int(ds['# VMs total']),
      ...buildStorageCapacityFields(cap, used, free)
    };
  });
}

function buildStorageCapacityFields(cap, used, free) {
  return {
    capacity_mib: cap,
    used_mib: used,
    free_mib: free,
    capacity_gib: round2(cap / 1024),
    used_gib: round2(used / 1024),
    free_gib: round2(free / 1024),
    capacity: formatMiB(cap),
    used: formatMiB(used),
    free: formatMiB(free)
  };
}

function buildLicenseList(vLicense) {
  return vLicense
    .map(({ Name, 'License Name': LicenseName, name, Key, key, 'Expiration Date': ExpirationDate, expirationDate }) => ({
      name: Name ?? LicenseName ?? name ?? '—',
      key: Key ?? key ?? '—',
      expiration_date: ExpirationDate ?? expirationDate ?? '—'
    }))
    .filter(x => x.name !== '—');
}

function buildPortGroups(vPort, dvPort) {
  const standardMap = new Map();
  const distributedMap = new Map();

  for (const pg of vPort) {
    const name = pg['Port Group'];
    if (!name) continue;

    const key = `${name}|${pg.Switch || ''}|${pg.Host || ''}`;

    if (!standardMap.has(key)) {
      standardMap.set(key, buildPortGroupEntry(pg, name, 'vSwitch Standard', pg.Host || ''));
    }
  }

  for (const pg of dvPort) {
    const name = pg.Port || pg['Port Group'];
    if (!name) continue;

    const key = `${name}|${pg.Switch || ''}`;
    const entry = buildPortGroupEntry(pg, name, 'vDistributed Switch', '');

    if (!distributedMap.has(key)) {
      distributedMap.set(key, entry);
    } else {
      const current = distributedMap.get(key);
      current.active_uplink = mergeUplinkStrings(current.active_uplink, entry.active_uplink);
    }
  }

  return [...standardMap.values(), ...distributedMap.values()];
}

function buildPortGroupEntry(row, name, type, host) {
  return {
    portgroup: name,
    switch: row.Switch || '',
    vlan: row.VLAN ?? 'n/a',
    host,
    active_uplink: extractUplinks(row),
    type
  };
}

function mergeUplinkStrings(a, b) {
  return [...new Set([
    ...String(a || '').split(', ').filter(Boolean),
    ...String(b || '').split(', ').filter(Boolean)
  ])].join(', ');
}

function extractUplinks(row) {
  return Object.keys(row)
    .filter(k => /^Active Uplink/i.test(k))
    .map(k => row[k])
    .filter(Boolean)
    .join(', ');
}

// ─── generic helpers ──────────────────────────────────────────────────────────
function hasClusters(vHost) {
  return vHost.some(h => !!h.Cluster);
}

function detectOsKind(os) {
  const t = String(os || '');
  if (/windows/i.test(t)) return 'windows';
  if (/linux|ubuntu|centos|debian|rhel|red hat|suse|fedora|oracle linux|coreos|arch linux|gentoo/i.test(t)) return 'linux';
  return 'other';
}

function compareVersions(a, b) {
  const pa = cleanVersion(a).split('.').map(x => parseInt(x, 10) || 0);
  const pb = cleanVersion(b).split('.').map(x => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function normalizeProcessor(cpuModel) {
  if (!cpuModel) return '—';
  return cpuModel
    .replace(/\(R\)/g, '')
    .replace(/\(TM\)/g, '')
    .replace(/\bCPU\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPathParts(path) {
  if (!path || typeof path !== 'string') return [];
  return path.split('/').map(s => s.trim()).filter(Boolean);
}

function excelSerialToDate(value, roundMs = true, minSerial = EXCEL_UNIX_EPOCH_SERIAL) {
  const serial = num(value);
  if (serial <= minSerial) return null;

  const ms = (serial - EXCEL_UNIX_EPOCH_SERIAL) * MS_PER_DAY;
  const dt = new Date(roundMs ? Math.round(ms) : ms);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function daysSinceDate(dt, allowFuture = true) {
  if (!dt || Number.isNaN(dt.getTime())) return null;
  if (!allowFuture && dt.getTime() > Date.now()) return null;
  return Math.floor((Date.now() - dt.getTime()) / MS_PER_DAY);
}

function calcVmUptimeDays(vm) {
  if (vm.Powerstate !== 'poweredOn') return null;
  return daysSinceDate(excelSerialToDate(vm.PowerOn, false), false);
}

function parseResourcePoolPath(path) {
  const parts = splitPathParts(path);

  return {
    path: path || '—',
    datacenter: parts[0] || '—',
    cluster: parts[1] || '—',
    provider_vdc: parts[3] || '—',
    pool: parts[4] || '—'
  };
}

function parseFolderPath(path) {
  const parts = splitPathParts(path);

  return {
    path: path || '—',
    datacenter: parts[0] || '—',
    folder_root: parts[1] || '—',
    organization: parts[2] || '—',
    vdc: parts[3] || '—',
    vm_folder: parts[4] || '—'
  };
}

function cleanVersion(v) {
  return String(v || '').trim().replace(/[^\d.]/g, '') || '0.0.0';
}

function sanitizeName(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function uniqueBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = item?.[key];
    if (k && !map.has(k)) map.set(k, item);
  }
  return [...map.values()];
}

function uniqueValues(items, mapper) {
  return [...new Set(items.map(mapper).filter(Boolean))];
}

function num(v) {
  if (typeof v === 'string') return parseFloat(v.replace(/,/g, '')) || 0;
  return Number(v) || 0;
}

function int(v) {
  return parseInt(v, 10) || 0;
}

function parseMiB(val) {
  return num(val);
}

function formatMiB(miB) {
  return formatGiBValue(miB / 1024);
}

function formatGiB(valueGiB) {
  return formatGiBValue(num(valueGiB));
}

function formatGiBValue(giB) {
  return giB >= 1024 ? `${(giB / 1024).toFixed(2)} TiB` : `${giB.toFixed(2)} GiB`;
}

function formatGHz(valueGHz) {
  const n = num(valueGHz);
  return n >= 1024 ? `${(n / 1024).toFixed(2)} Thz` : `${n.toFixed(2)} Ghz`;
}

function pct(used, total) {
  if (!total) return 0;
  return round2((used / total) * 100);
}

function round2(n) {
  return +num(n).toFixed(2);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

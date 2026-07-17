import { useMemo, useState } from "react";
import * as XLSX from 'xlsx';

import { GoInfo } from "react-icons/go";
import { HiOutlineBadgeCheck } from "react-icons/hi";
import { LuDatabase, LuNetwork, LuServer, LuTvMinimalPlay, LuTvMinimal, LuKeyRound, LuMonitorCog } from "react-icons/lu";
import { PiComputerTowerLight, PiCpu, PiChartDonutDuotone, PiChartDonutFill } from "react-icons/pi";
import { BsMemory, BsDeviceHdd } from "react-icons/bs";
import { TbServerCog, TbCloudNetwork, TbCpu2, TbPhotoSensor2, TbCpuOff } from "react-icons/tb";
import { BiSolidReport } from "react-icons/bi";
import { GrConfigure, GrVmware } from "react-icons/gr";
import { getUiText } from '../lib/uiText';

const VMwareInfraDash = ({ data, handleReset, language = 'it' }) => {
  const [activeTab, setActiveTab]                       = useState('datacenter');
  const [marginInfra, setMarginInfra]                   = useState("10");
  const [filterNodes, setFilterNodes]                   = useState("");
  const [filterVms, setFilterVms]                       = useState("");
  const [filterStorages, setFilterStorages]             = useState("");
  const [filterNetworks, setFilterNetworks]             = useState("");
  const [filterResourcePools, setFilterResourcePools]   = useState("");
  const { common, infraDashboard: copy } = getUiText(language);

  const datacenter = data?.datacenter || {};
  const clusters   = data?.clusters || [];
  const hasCluster = Array.isArray(clusters) && clusters.length > 0;
  const resources  = datacenter?.resources || {};
  const version    = datacenter?.version || {};
  const summary    = data?.summary || {};
  const licenses   = data?.licenses || [];
  const inventory  = summary?.inventory || {};
  const nodes      = Array.isArray(data?.nodes)    ? data.nodes    : [];
  const vms        = Array.isArray(data?.vm)       ? data.vm       : [];
  const storages   = Array.isArray(data?.storages) ? data.storages : [];
  const marginData = summary?.margin || {};

  const runningVMs = inventory?.vm_powered_on ?? vms.filter(i => String(i?.state).toLowerCase() === "poweredon").length;
  const stoppedVMs = inventory?.vm_powered_off ?? vms.filter(i => String(i?.state).toLowerCase() !== "poweredon").length;

  const windows_computeon = summary?.os_compute_on?.windows || {};
  const linux_computeon   = summary?.os_compute_on?.linux   || {};
  const other_computeon   = summary?.os_compute_on?.other   || {};

  const os        = data?.summary?.os ?? {};
  const linuxVMs  = os.linux   ?? 0;
  const windowsVMs= os.windows ?? 0;
  const otherVMs  = os.other   ?? 0;

  const totalVmCpu    = summary?.compute?.used?.vcpus      ?? vms.reduce((s, i) => s + (Number(i?.vcpus) || 0), 0);
  const totalVmRamGb  = summary?.compute?.used?.ramGiB     ?? vms.reduce((s, i) => s + (Number(i?.vram_gib) || 0), 0);
  const totalVmDiskGb = summary?.compute?.used?.storageGiB ?? vms.reduce((s, i) => s + (Number(i?.storage_gib) || 0), 0);

  const usedVcpus   = resources?.cpu?.vcpu_used  ?? summary?.compute?.used?.vcpus          ?? "N/D";
  const usedRam     = resources?.ram?.used        ?? summary?.compute?.used?.ramDisplay     ?? "N/D";
  const usedStorage = resources?.storage?.used   ?? summary?.compute?.used?.storageDisplay ?? "N/D";
  const totalGhz    = resources?.cpu?.ghz_total  ?? summary?.compute?.total?.ghz            ?? "N/D";
  const usedGhz     = resources?.cpu?.ghz_used   ?? summary?.compute?.used?.ghz             ?? "N/D";

  const vCPUPercentageDC = Number(
    ((summary?.compute?.used?.vcpus / summary?.compute?.total?.vcpus) * 100).toFixed(2)
  );

  const formatDiskTotal = (gb) => {
    if (!Number.isFinite(Number(gb)) || Number(gb) <= 0) return "0 GB";
    return Number(gb) >= 1000 ? `${(Number(gb) / 1024).toFixed(2)} TB` : `${Number(gb).toFixed(2)} GB`;
  };
  const totalVmDiskFormatted = formatDiskTotal(totalVmDiskGb);

  const networkCards = useMemo(() => {
    const portgroups = Array.isArray(data?.network?.portgroups) ? data.network.portgroups : [];
    return portgroups.map((item, index) => ({
      node:      item?.host         || "N/D",
      iface:     item?.portgroup    || `Portgroup ${index + 1}`,
      ports:     item?.switch       || "N/D",
      vlanAware: item?.vlan         ?? "N/D",
      uplink:    item?.active_uplink|| "N/D",
      type:      item?.type         || "N/D",
    }));
  }, [data]);

  const getSnapshotsDetails = (vm) =>
    Array.isArray(vm?.snapshots)
      ? vm.snapshots.map(s => [s?.name, s?.date_time, s?.description].filter(Boolean).join(" ")).join(" ")
      : "";

  const getSnapshotsLabel = (vm) =>
    vm?.snapshots_count > 0 ? `${vm.snapshots_count} snpsht` : copy.notPresent;

  const getVmFilterString = (vm) =>
    [vm?.vm_id, vm?.name, vm?.host, vm?.state, vm?.vcpus, vm?.vram_gib,
     vm?.primary_datastore, vm?.primary_network, vm?.resource_pool?.pool,
     vm?.folder?.path, getSnapshotsLabel(vm), getSnapshotsDetails(vm), vm?.os_config, vm?.uptime_days]
    .join(" ").toLowerCase();

  const filteredVms = vms.filter(vm => getVmFilterString(vm).includes(filterVms.toLowerCase()));

  const exportVmListXls = () => {
    const vmTable = filteredVms.map(vm => ({
      ID: vm?.vm_id || "N/D",
      [copy.name]: vm?.name || "N/D",
      Host: vm?.host || "N/D",
      [copy.status]: vm?.state || "N/D",
      vCPU: vm?.vcpus ?? "N/D",
      RAM: vm?.vram_gib != null ? `${vm.vram_gib} GB` : "N/D",
      [copy.primaryStorage]: vm?.primary_datastore || "N/D",
      [copy.primaryNetwork]: vm?.primary_network || "N/D",
      "Resource Pool": vm?.resource_pool?.pool || "N/D",
      Folder: vm?.folder?.path || "N/D",
      Snapshots: vm?.snapshots_count > 0 ? `${copy.present}: n°${vm.snapshots_count}` : copy.notPresent,
      [copy.snapshotDetails]: Array.isArray(vm?.snapshots) && vm.snapshots.length > 0
        ? vm.snapshots.map(s => `${s?.name || "N/D"} | ${s?.date_time || "N/D"} | ${s?.description || "N/D"}`).join(" || ")
        : copy.noSnapshot,
      "Guest OS": vm?.os_config || "N/D",
      Uptime: vm?.uptime_days || "N/D",
    }));
    const safeEndpoint = String(datacenter?.endpoint || "vmware-iv").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const safeFilter   = String(filterVms || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const fileName = `${safeEndpoint}${safeFilter ? `-${safeFilter}` : ""}-vm-list.xlsx`;
    const ws = XLSX.utils.json_to_sheet(vmTable);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VMs");
    XLSX.writeFile(wb, fileName);
  };

  const formatExcelDate = (value) => {
    if (value === null || value === undefined || value === "") return "N/D";
    if (typeof value === "string" && value.trim().toLowerCase() === "never") return "Never";
    if (typeof value === "number") {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const date  = new Date(epoch.getTime() + value * 86400000);
      return date.toLocaleDateString(language === 'it' ? "it-IT" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
    return value;
  };

  const resourcePools = useMemo(() => {
    if (!Array.isArray(vms)) return [];
    const norm   = v => (v === null || v === undefined) ? "" : String(v).trim();
    const isMiss = v => { const n = norm(v); return n === "" || n === "-" || n === "—" || n.toLowerCase() === "n/d" || n.toLowerCase() === "null" || n.toLowerCase() === "undefined"; };
    const lastSeg  = p => { const n = norm(p); if (isMiss(n)) return ""; const pts = n.split("/").filter(Boolean); return pts.length ? pts[pts.length - 1] : ""; };
    const extractPN = v => {
      const n = norm(v); if (isMiss(n)) return { name: "", id: "" };
      const m = n.match(/^(.*?)\s*\(([a-zA-Z0-9-]+)\)\s*$/);
      return m ? { name: m[1].trim(), id: m[2].trim() } : { name: n, id: "" };
    };
    const grouped = vms.reduce((acc, vm) => {
      const rp = vm?.resource_pool || {}; const folder = vm?.folder || {};
      const dc   = !isMiss(rp?.datacenter)   ? norm(rp?.datacenter)   : !isMiss(folder?.datacenter) ? norm(folder?.datacenter) : "N/D";
      const cl   = !isMiss(rp?.cluster)      ? norm(rp?.cluster)      : "N/D";
      const pvdc = !isMiss(rp?.provider_vdc) ? norm(rp?.provider_vdc) : "";
      const { name: pn, id: pi } = extractPN(!isMiss(rp?.pool) ? norm(rp?.pool) : "");
      const pp = !isMiss(rp?.path) ? norm(rp?.path) : ""; const pt = lastSeg(pp);
      let key = "", rn = "", rid = "", rpath = "", rtype = "";
      if (pn)       { key = pp || `pool::${dc}::${cl}::${pn}`;          rn = pn;          rid = pi; rpath = pp || "N/D"; rtype = "resource_pool"; }
      else if (pvdc){ key = `provider-vdc::${dc}::${cl}::${pvdc}`;     rn = pvdc;                   rpath = pp || "N/D"; rtype = "provider_vdc"; }
      else if (pt)  { const isg = norm(pt).toLowerCase() === "resources"; const rpt = isg ? `Resources - ${cl}` : pt; key = `path-tail::${dc}::${cl}::${rpt}`; rn = rpt; rpath = pp; rtype = "path_fallback"; }
      else          { key = `dc-rp::${dc}`;  rn = `DC-RP-${dc}`; rpath = `DC-RP-${dc}`; rtype = "datacenter_fallback"; }
      if (!acc[key]) acc[key] = { name: rn || "N/D", id: rid || "", path: rpath || "N/D", datacenter: dc || "N/D", cluster: cl || "N/D", provider_vdc: pvdc || "N/D", type: rtype, vm_count: 0, total_vcpus: 0, total_vram_gib: 0, total_storage_gib: 0, vms: [] };
      acc[key].vm_count        += 1;
      acc[key].total_vcpus     += Number(vm?.vcpus || 0);
      acc[key].total_vram_gib  += Number(vm?.vram_gib || 0);
      acc[key].total_storage_gib += Number(vm?.storage_gib || 0);
      acc[key].vms.push({ name: vm?.name || "N/D", state: vm?.state || "N/D", host: vm?.host || "N/D", ip: vm?.primary_ipaddress || "N/D", os: vm?.os_config || "N/D", vcpus: Number(vm?.vcpus || 0), vram_gib: Number(vm?.vram_gib || 0), storage_gib: Number(vm?.storage_gib || 0) });
      return acc;
    }, {});
    return Object.values(grouped).map(pool => ({
      ...pool,
      total_vram:    `${pool.total_vram_gib.toFixed(2)} GiB`,
      total_storage: pool.total_storage_gib >= 1024 ? `${(pool.total_storage_gib / 1024).toFixed(2)} TiB` : `${pool.total_storage_gib.toFixed(2)} GiB`,
      vms: [...pool.vms].sort((a, b) => a.name.localeCompare(b.name)),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [vms]);

  const hasResourcePools = resourcePools.length > 0;
  const hasLicenses      = Array.isArray(licenses) && licenses.length > 0;

  const selectedMargin    = marginInfra === "10" ? marginData?.plus10 : marginInfra === "20" ? marginData?.plus20 : marginData?.plus30 || {};
  const vCpuWithMargin    = selectedMargin?.vcpus         ?? "N/D";
  const ramWithMargin     = selectedMargin?.ramDisplay     ?? "N/D";
  const storageWithMargin = selectedMargin?.storageDisplay ?? "N/D";
  const ghzWithMargin     = selectedMargin?.ghzDisplay     ?? "N/D";

  const VMW_TABS = [
    { id: 'datacenter',     labelKey: 'datacenter',    Icon: TbServerCog },
    ...(hasCluster         ? [{ id: 'cluster',         labelKey: 'cluster',       Icon: TbServerCog }]       : []),
    { id: 'vm_rec',         labelKey: 'vmSummaryTab',   Icon: LuTvMinimalPlay },
    ...(hasLicenses        ? [{ id: 'license',         labelKey: 'licenses',      Icon: LuKeyRound }]         : []),
    { id: 'nodes',          labelKey: 'esxiNodes',      Icon: PiComputerTowerLight },
    ...(hasResourcePools   ? [{ id: 'resource_pools',  labelKey: 'resourcePools', Icon: PiChartDonutDuotone }]: []),
    { id: 'vm_list',        labelKey: 'vmList',         Icon: LuTvMinimalPlay },
    { id: 'datastore',      labelKey: 'datastore',      Icon: LuDatabase },
    { id: 'network',        labelKey: 'networkVmware',  Icon: LuNetwork },
    { id: 'margins',        labelKey: 'margins',        Icon: GrConfigure },
  ];

  const FilterInput = ({ placeholder, value, onChange }) => (
    <div className="vmw-iv-dashboard-filtergroup">
      <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="vmw-iv-dashboard-filter-input" />
    </div>
  );

  return (
    <div className="vmw-iv-dashboard-container">
      <h2 className="vmw-iv-dashboard-title">
        <GrVmware className="vmw-iv-dashboard-icon title" />
        {datacenter?.endpoint || datacenter?.node || "InfrastructureView"}
      </h2>
      <h3 className="vmw-iv-dashboard-subtitle vmxtools">
        <TbPhotoSensor2 className="vmw-iv-dashboard-icon vmxtools" />
        vmwtools: {data?.vmwtools || "N/D"} — {copy.reportCaptured}: {data?.report?.captured_at || data?.report || "N/D"}
      </h3>

      <div className="vmw-iv-dashboard-tabbar">
        <button className="vmw-iv-dashboard-btn-secondary" onClick={handleReset}>
          <BiSolidReport className="vmw-iv-dashboard-icon mini" />
          {copy.loadAnotherVmware}
        </button>
        <div className="vmw-iv-tabnav-sep" aria-hidden="true" />
        <nav className="vmw-iv-tabnav">
          {VMW_TABS.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              className={`vmw-iv-tabnav-btn${activeTab === id ? ' active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon className="vmw-iv-dashboard-icon mini" />
              {copy.tabs[labelKey] || labelKey}
            </button>
          ))}
        </nav>
      </div>

      <h3 className="vmw-iv-dashboard-subtitle"><GoInfo className="vmw-iv-dashboard-icon" />{copy.generalInfo}</h3>
      <div className="vmw-iv-dashboard-grid gnr">
        <div className="vmw-iv-dashboard-card gnr"><h3><HiOutlineBadgeCheck className="vmw-iv-dashboard-icon" />Endpoint</h3><p>{datacenter?.endpoint || datacenter?.node || "N/D"}</p></div>
        <div className="vmw-iv-dashboard-card gnr"><h3><HiOutlineBadgeCheck className="vmw-iv-dashboard-icon" />{copy.version}</h3><p>{`${hasCluster ? "vCenter" : "ESXi"} ${version?.version || "N/D"}`}</p></div>
        <div className="vmw-iv-dashboard-card gnr"><h3><HiOutlineBadgeCheck className="vmw-iv-dashboard-icon" />Build</h3><p>{version?.build || version?.release || "N/D"}</p></div>
        <div className="vmw-iv-dashboard-card gnr"><h3><PiComputerTowerLight className="vmw-iv-dashboard-icon" />{copy.totalEsxiNodes}</h3><p>{inventory?.host_total ?? nodes.length}</p></div>
        <div className="vmw-iv-dashboard-card gnr"><h3><LuTvMinimal className="vmw-iv-dashboard-icon" />{copy.totalVms}</h3><p>{inventory?.vm_total ?? vms.length}</p></div>
        <div className="vmw-iv-dashboard-card gnr"><h3><LuDatabase className="vmw-iv-dashboard-icon" />{copy.totalStorages}</h3><p>{inventory?.datastore_total ?? storages.length}</p></div>
        <div className="vmw-iv-dashboard-card gnr"><h3><TbCloudNetwork className="vmw-iv-dashboard-icon" />{copy.totalNetworks}</h3><p>{inventory?.network_total ?? networkCards.length}</p></div>
        <div className="vmw-iv-dashboard-card gnr"><h3><LuServer className="vmw-iv-dashboard-icon" />{copy.datacenterType}</h3><p>{datacenter?.type || "N/D"}</p></div>
      </div>

      <div key={activeTab} className="vmw-iv-tabcontent">

        {/* ── DATACENTER ── */}
        {activeTab === 'datacenter' && (
          <div className="vmw-iv-dashboard-subsection">
            <h3 className="vmw-iv-dashboard-subtitle"><TbServerCog className="vmw-iv-dashboard-icon" />{copy.resourceSummary}</h3>
            <div className="vmw-iv-dashboard-grid computehd">
              <div className="vmw-iv-dashboard-card compute"><h3><TbCpuOff className="vmw-iv-dashboard-icon" />vCPU({copy.totalShort})</h3><p>{resources?.cpu?.vcpu_total ?? summary?.compute?.total?.vcpus ?? "N/D"}</p></div>
              <div className="vmw-iv-dashboard-card compute"><h3><PiCpu className="vmw-iv-dashboard-icon" />Ghz({copy.totalShort})</h3><p>{summary?.compute?.total?.ghz || totalGhz} Ghz</p></div>
              <div className="vmw-iv-dashboard-card compute"><h3><BsMemory className="vmw-iv-dashboard-icon" />RAM({copy.totalShort})</h3><p>{resources?.ram?.total || summary?.compute?.total?.ramDisplay || "N/D"}</p></div>
              <div className="vmw-iv-dashboard-card compute"><h3><BsDeviceHdd className="vmw-iv-dashboard-icon" />Storage({copy.totalShort})</h3><p>{resources?.storage?.total || summary?.compute?.total?.storageDisplay || "N/D"}</p></div>
            </div>
            <div className="vmw-iv-dashboard-grid computehd">
              <div className="vmw-iv-dashboard-card compute"><h3><TbCpuOff className="vmw-iv-dashboard-icon" />vCPU({copy.inUse})</h3><p>{resources?.cpu?.vcpu_used ?? summary?.compute?.used?.vcpus ?? "N/D"}</p></div>
              <div className="vmw-iv-dashboard-card compute"><h3><PiCpu className="vmw-iv-dashboard-icon" />Ghz({copy.inUse})</h3><p>{summary?.compute?.used?.ghzDisplay || usedGhz}</p></div>
              <div className="vmw-iv-dashboard-card compute"><h3><BsMemory className="vmw-iv-dashboard-icon" />RAM({copy.inUse})</h3><p>{resources?.ram?.used || summary?.compute?.used?.ramDisplay || "N/D"}</p></div>
              <div className="vmw-iv-dashboard-card compute"><h3><BsDeviceHdd className="vmw-iv-dashboard-icon" />Storage({copy.inUse})</h3><p>{resources?.storage?.used || summary?.compute?.used?.storageDisplay || "N/D"}</p></div>
            </div>
            <div className="vmw-iv-dashboard-grid computehd">
              <div className="vmw-iv-dashboard-card compute"><h3><TbCpuOff className="vmw-iv-dashboard-icon" />vCPU(%)</h3><p>{vCPUPercentageDC} %</p></div>
              <div className="vmw-iv-dashboard-card compute"><h3><TbCpuOff className="vmw-iv-dashboard-icon" />Ghz(%)</h3><p>{resources?.cpu?.percentage ?? "N/D"} %</p></div>
              <div className="vmw-iv-dashboard-card compute"><h3><BsMemory className="vmw-iv-dashboard-icon" />RAM(%)</h3><p>{resources?.ram?.percentage || "N/D"} %</p></div>
              <div className="vmw-iv-dashboard-card compute"><h3><BsDeviceHdd className="vmw-iv-dashboard-icon" />Storage(%)</h3><p>{resources?.storage?.percentage || "N/D"} %</p></div>
            </div>
          </div>
        )}

        {/* ── CLUSTER ── */}
        {activeTab === 'cluster' && hasCluster && (
          <>
            {clusters.map((cl, ci) => (
              <div className="vmw-iv-dashboard-subsection" key={`${cl?.name || "cluster"}-${ci}`}>
                <h3 className="vmw-iv-dashboard-subtitle"><TbServerCog className="vmw-iv-dashboard-icon" />{cl?.name || "N/D"} Cluster</h3>
                <div className="vmw-iv-dashboard-grid clu">
                  <div className="vmw-iv-dashboard-card gnr"><h3><LuServer className="vmw-iv-dashboard-icon" />{copy.totalNodes}</h3><p>{cl?.configured_nodes ?? cl?.nodes?.length ?? "N/D"}</p></div>
                  <div className="vmw-iv-dashboard-card gnr"><h3><TbCpu2 className="vmw-iv-dashboard-icon" /> Ghz(TOT)</h3><p>{cl?.resources.cpu.ghz_display ?? "N/D"}</p></div>
                  <div className="vmw-iv-dashboard-card gnr"><h3><BsMemory className="vmw-iv-dashboard-icon" /> RAM(TOT)</h3><p>{cl?.resources.ram.total ?? "N/D"}</p></div>
                  <div className="vmw-iv-dashboard-card gnr"><h3><BsDeviceHdd className="vmw-iv-dashboard-icon" /> Storage(TOT)</h3><p>{cl?.resources.storage.total ?? "N/D"}</p></div>
                  <div className="vmw-iv-dashboard-card gnr"><h3><GoInfo className="vmw-iv-dashboard-icon" />HA</h3><p>{cl?.ha ?? "N/D"}</p></div>
                  <div className="vmw-iv-dashboard-card gnr"><h3><GoInfo className="vmw-iv-dashboard-icon" />DRS</h3><p>{cl?.drs ?? "N/D"}</p></div>
                </div>
                <div className="vmw-iv-dashboard-grid clu-nodes">
                  {(cl?.nodes || []).map((node, ni) => (
                    <div className="vmw-iv-dashboard-card clu-nodes" key={`${node?.hostname || "node"}-${ni}`}>
                      <h3><LuServer className="vmw-iv-dashboard-icon" />{node?.hostname || `Host ${ni + 1}`}</h3>
                      <p>{node?.version || "N/D"}</p>
                      <p>Build ESXi: {node?.build || "N/D"}</p>
                      <p>{copy.uptime}: {node?.uptime_days || "N/D"} days</p>
                      <p>Model: {node?.vendor || "N/D"} {node?.model || "N/D"}</p>
                      <p>ServiceTag: {node?.service_tag || "N/D"}</p>
                      <p>{copy.status}: {node?.maintenance === "True" ? "maintenance" : common.online}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── VM RIEPILOGO ── */}
        {activeTab === 'vm_rec' && (
          <>
            <div className="vmw-iv-dashboard-subsection">
              <h3 className="vmw-iv-dashboard-subtitle"><LuTvMinimalPlay className="vmw-iv-dashboard-icon" /> {copy.vmSummary}</h3>
              <div className="vmw-iv-dashboard-grid vms">
                <div className="vmw-iv-dashboard-card"><h3><LuTvMinimal className="vmw-iv-dashboard-icon" />{copy.totalVms}</h3><p>{inventory?.vm_total ?? vms.length}</p></div>
                <div className="vmw-iv-dashboard-card"><h3><LuTvMinimal className="vmw-iv-dashboard-icon" />VM Running</h3><p>{runningVMs}</p></div>
                <div className="vmw-iv-dashboard-card"><h3><LuTvMinimal className="vmw-iv-dashboard-icon" />VM Stopped</h3><p>{stoppedVMs}</p></div>
                <div className="vmw-iv-dashboard-card"><h3><TbCpu2 className="vmw-iv-dashboard-icon" />{copy.totalVcpu}</h3><p>{totalVmCpu}</p></div>
                <div className="vmw-iv-dashboard-card"><h3><BsMemory className="vmw-iv-dashboard-icon" />{copy.totalRam}</h3><p>{Number.isFinite(Number(totalVmRamGb)) ? `${Number(totalVmRamGb)} GB` : totalVmRamGb}</p></div>
                <div className="vmw-iv-dashboard-card"><h3><BsDeviceHdd className="vmw-iv-dashboard-icon" />{copy.totalStorage}</h3><p>{totalVmDiskFormatted}</p></div>
                <div className="vmw-iv-dashboard-card"><h3><LuTvMinimal className="vmw-iv-dashboard-icon" />VM Linux</h3><p>{linuxVMs}</p></div>
                <div className="vmw-iv-dashboard-card"><h3><LuTvMinimal className="vmw-iv-dashboard-icon" />VM Windows</h3><p>{windowsVMs}</p></div>
                <div className="vmw-iv-dashboard-card"><h3><LuTvMinimal className="vmw-iv-dashboard-icon" />{copy.otherVms}</h3><p>{otherVMs}</p></div>
              </div>
            </div>
            <h3 className="vmw-iv-dashboard-subtitle"><LuMonitorCog className="vmw-iv-dashboard-icon" /> {copy.windowsVmActiveSummary}</h3>
            <div className="vmw-iv-dashboard-grid vmsrec">
              <div className="vmw-iv-dashboard-card vmsrec"><h3><TbCpuOff className="vmw-iv-dashboard-icon" /> vCPU</h3><p>{windows_computeon.vcpus}</p></div>
              <div className="vmw-iv-dashboard-card vmsrec"><h3><BsMemory className="vmw-iv-dashboard-icon" /> vRAM</h3><p>{windows_computeon.vram}</p></div>
              <div className="vmw-iv-dashboard-card vmsrec"><h3><BsDeviceHdd className="vmw-iv-dashboard-icon" /> Storage</h3><p>{windows_computeon.storage}</p></div>
              <div className="vmw-iv-dashboard-card vmsrec"><h3><LuTvMinimal className="vmw-iv-dashboard-icon" /> {copy.totalVms}</h3><p>{windowsVMs}</p></div>
            </div>
            <h3 className="vmw-iv-dashboard-subtitle"><LuMonitorCog className="vmw-iv-dashboard-icon" /> {copy.linuxVmActiveSummary}</h3>
            <div className="vmw-iv-dashboard-grid vmsrec">
              <div className="vmw-iv-dashboard-card vmsrec"><h3><TbCpuOff className="vmw-iv-dashboard-icon" /> vCPU</h3><p>{linux_computeon.vcpus}</p></div>
              <div className="vmw-iv-dashboard-card vmsrec"><h3><BsMemory className="vmw-iv-dashboard-icon" /> vRAM</h3><p>{linux_computeon.vram}</p></div>
              <div className="vmw-iv-dashboard-card vmsrec"><h3><BsDeviceHdd className="vmw-iv-dashboard-icon" /> Storage</h3><p>{linux_computeon.storage}</p></div>
              <div className="vmw-iv-dashboard-card vmsrec"><h3><LuTvMinimal className="vmw-iv-dashboard-icon" /> {copy.totalVms}</h3><p>{linuxVMs}</p></div>
            </div>
            <h3 className="vmw-iv-dashboard-subtitle"><LuMonitorCog className="vmw-iv-dashboard-icon" /> {copy.otherVmActiveSummary}</h3>
            <div className="vmw-iv-dashboard-grid vmsrec">
              <div className="vmw-iv-dashboard-card vmsrec"><h3><TbCpuOff className="vmw-iv-dashboard-icon" /> vCPU</h3><p>{other_computeon.vcpus}</p></div>
              <div className="vmw-iv-dashboard-card vmsrec"><h3><BsMemory className="vmw-iv-dashboard-icon" /> vRAM</h3><p>{other_computeon.vram}</p></div>
              <div className="vmw-iv-dashboard-card vmsrec"><h3><BsDeviceHdd className="vmw-iv-dashboard-icon" /> Storage</h3><p>{other_computeon.storage}</p></div>
              <div className="vmw-iv-dashboard-card vmsrec"><h3><LuTvMinimal className="vmw-iv-dashboard-icon" /> {copy.totalVms}</h3><p>{otherVMs}</p></div>
            </div>
          </>
        )}

        {/* ── LICENSE ── */}
        {activeTab === 'license' && hasLicenses && (
          <div className="vmw-iv-dashboard-subsection">
            <h3 className="vmw-iv-dashboard-subtitle"><LuKeyRound className="vmw-iv-dashboard-icon" /> {copy.licenseSummary}</h3>
            <div className="vmw-iv-dashboard-grid lic">
              {licenses.map((lic, i) => (
                <div className="vmw-iv-dashboard-card lic" key={i}>
                  <h3><LuKeyRound className="vmw-iv-dashboard-icon" /> {copy.license} {i + 1}</h3>
                  <p><strong>{copy.type}:</strong> {lic.name}</p>
                  <p><strong>{copy.key}:</strong> {lic.key}</p>
                  <p><strong>{copy.expiration}:</strong> {formatExcelDate(lic.expiration_date)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── NODES ── */}
        {activeTab === 'nodes' && (
          <div className="vmw-iv-dashboard-subsection">
            <h3 className="vmw-iv-dashboard-subtitle"><PiComputerTowerLight className="vmw-iv-dashboard-icon" /> {copy.esxiNodesView}</h3>
            <FilterInput placeholder={copy.filterNodes} value={filterNodes} onChange={setFilterNodes} />
            <div className="vmw-iv-dashboard-grid">
              {nodes
                .filter(node => [node?.name, node?.hostname, node?.maintenance === "True" ? "maintenance" : "online", node?.version, node?.build, node?.uptime_days, node?.processor, node?.resources?.cpu?.packages, node?.resources?.cpu?.cores, node?.resources?.cpu?.threads, node?.resources?.cpu?.ghz, node?.resources?.ram?.total].join(" ").toLowerCase().includes(filterNodes.toLowerCase()))
                .map((node, i) => (
                  <div key={node?.name || node?.hostname || i} className="vmw-iv-dashboard-card esxnode">
                    <h3><LuServer className="vmw-iv-dashboard-icon" />{node?.name || node?.hostname || "N/D"}</h3>
                    <p><strong>{copy.status}:</strong> {node?.maintenance === "True" ? "maintenance" : common.online}</p>
                    <p><strong>{copy.version}:</strong> {node?.version || "N/D"}</p>
                    <p><strong>Build:</strong> {node?.build || "N/D"}</p>
                    <p><strong>Cluster:</strong> {node?.cluster || "N/D"}</p>
                    <p><strong>{copy.model}:</strong> {node?.vendor || "N/D"} {node?.model || "N/D"}</p>
                    <p><strong>ServiceTag:</strong> {node?.service_tag || "N/D"}</p>
                    <p><strong>CPU:</strong> {node?.processor || "N/D"}</p>
                    <p><strong>Core({copy.totalShort}):</strong> {node?.resources?.cpu?.cores ?? "N/D"}</p>
                    <p><strong>Ghz({copy.totalShort}):</strong> {node?.resources?.cpu?.ghz ? `${node.resources.cpu.ghz} GHz` : "N/D"}</p>
                    <p><strong>RAM({copy.totalShort}):</strong> {node?.resources?.ram?.total || "N/D"}</p>
                    <p><strong>{copy.vmOnNode}:</strong> {node?.vm_number || "0"}</p>
                    <p><strong>Uptime:</strong> {node?.uptime_days != null ? `${node.uptime_days} days` : "N/D"}</p>
                    <p><strong>UUID:</strong> {node?.uuid || "N/D"}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── RESOURCE POOLS ── */}
        {activeTab === 'resource_pools' && hasResourcePools && (
          <div className="vmw-iv-dashboard-subsection">
            <h3 className="vmw-iv-dashboard-subtitle"><PiChartDonutDuotone className="vmw-iv-dashboard-icon" /> Resource Pool</h3>
            <FilterInput placeholder={copy.filterResourcePool} value={filterResourcePools} onChange={setFilterResourcePools} />
            <div className="vmw-iv-dashboard-grid">
              {resourcePools
                .filter(pool => [pool?.name, pool?.path, pool?.datacenter, pool?.cluster, pool?.provider_vdc, pool?.vm_count, pool?.total_vcpus, pool?.total_vram, pool?.total_storage, ...(pool?.vms?.map(v => v?.name) || [])].join(" ").toLowerCase().includes(filterResourcePools.toLowerCase()))
                .map((pool, i) => (
                  <div key={`${pool?.path || pool?.name || "rp"}-${i}`} className="vmw-iv-dashboard-card esxnode">
                    <h3><PiChartDonutFill className="vmw-iv-dashboard-icon" /> {pool?.name || "N/D"}</h3>
                    <p><strong>Pool ID:</strong> {pool?.id || "N/D"}</p>
                    <p><strong>Datacenter:</strong> {pool?.datacenter || "N/D"}</p>
                    <p><strong>Cluster:</strong> {pool?.cluster || "N/D"}</p>
                    <p><strong>Provider vDC:</strong> {pool?.provider_vdc || "N/D"}</p>
                    <p><strong>{copy.vmCount}:</strong> {pool?.vm_count || 0}</p>
                    <p><strong>{copy.totalVcpu}:</strong> {pool?.total_vcpus || 0}</p>
                    <p><strong>{copy.totalRam}:</strong> {pool?.total_vram || "0 GiB"}</p>
                    <p><strong>{copy.totalStorage}:</strong> {pool?.total_storage || "0 GiB"}</p>
                    <p><strong>Path:</strong> {pool?.path || "N/D"}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── VM LIST ── */}
        {activeTab === 'vm_list' && (
          <div className="vmw-iv-dashboard-subsection">
            <h3 className="vmw-iv-dashboard-subtitle"><LuTvMinimalPlay className="vmw-iv-dashboard-icon" /> {copy.tabs.vmList}</h3>
            <div className="vmw-iv-dashboard-filtergroup">
              <input type="text" placeholder={copy.filterVm} value={filterVms} onChange={e => setFilterVms(e.target.value)} className="vmw-iv-dashboard-filter-input" />
              <button className="vmw-iv-dashboard-btn-secondary" onClick={exportVmListXls}>{copy.exportXls}</button>
            </div>
            <div className="vmw-iv-table-container">
              <table className="vmw-iv-table">
                <thead><tr>
                  <th>ID</th><th>{copy.name}</th><th>Host</th><th>{copy.status}</th><th>vCPU</th><th>RAM</th>
                  <th>{copy.primaryDisk}</th><th>Datastore</th><th>{copy.primaryNetwork}</th><th>Resource pool</th>
                  <th>Folder</th><th>N°Snapshots</th><th>{copy.snapshotDetails}</th><th>Guest OS</th><th>Uptime</th>
                </tr></thead>
                <tbody>
                  {filteredVms.map(vm => (
                    <tr key={vm?.vm_id}>
                      <td>{vm?.vm_id || "N/D"}</td><td>{vm?.name || "N/D"}</td><td>{vm?.host || "N/D"}</td>
                      <td>{vm?.state || "N/D"}</td><td>{vm?.vcpus ?? "N/D"}</td>
                      <td>{vm?.vram_gib != null ? `${vm.vram_gib} GB` : "N/D"}</td>
                      <td>{vm?.primary_disk_gib != null ? `${vm.primary_disk_gib} GB` : "N/D"}</td>
                      <td>{vm?.primary_datastore || "N/D"}</td><td>{vm?.primary_network || "N/D"}</td>
                      <td>{vm?.resource_pool?.pool || "N/D"}</td><td>{vm?.folder?.path || "N/D"}</td>
                      <td>{vm?.snapshots_count > 0 ? `${vm.snapshots_count} snpsht` : copy.notPresent}</td>
                      <td>{Array.isArray(vm?.snapshots) && vm.snapshots.length > 0 ? (
                        <div style={{ display: "grid", gap: "0.75rem", marginTop: "6px" }}>
                          {vm.snapshots.map((s, i) => (
                            <div key={i} style={{ display: "grid", gap: "0.2rem" }}>
                              <div><strong>{s?.name || "N/D"}</strong></div>
                              <div>{s?.date_time || "N/D"}</div>
                              <div>{s?.description || "N/D"}</div>
                            </div>
                          ))}
                        </div>
                      ) : copy.noSnapshot}</td>
                      <td>{vm?.os_config || "N/D"}</td><td>{vm?.uptime_days || "N/D"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DATASTORE ── */}
        {activeTab === 'datastore' && (
          <div className="vmw-iv-dashboard-subsection">
            <h3 className="vmw-iv-dashboard-subtitle"><LuDatabase className="vmw-iv-dashboard-icon" /> Datastore</h3>
            <FilterInput placeholder={copy.filterStorage} value={filterStorages} onChange={setFilterStorages} />
            <div className="vmw-iv-dashboard-grid">
              {storages
                .filter(s => [s?.name, s?.type, s?.major_version, s?.vm_count, s?.capacity, s?.used, s?.free].join(" ").toLowerCase().includes(filterStorages.toLowerCase()))
                .map((s, i) => (
                  <div key={`${s?.name || "storage"}-${i}`} className="vmw-iv-dashboard-card ds">
                    <h3><LuDatabase className="vmw-iv-dashboard-icon" /> {s?.name || "N/D"}</h3>
                    <p><strong>{copy.type}:</strong> {s?.type || "N/D"} {s?.major_version || "N/D"}</p>
                    <p><strong>{copy.vmCount}:</strong> {s?.vm_count || "N/D"}</p>
                    <p><strong>{copy.total}:</strong> {s?.capacity || "N/D"}</p>
                    <p><strong>{copy.used}:</strong> {s?.used || "N/D"}</p>
                    <p><strong>{copy.free}:</strong> {s?.free || "N/D"}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── NETWORK ── */}
        {activeTab === 'network' && (
          <div className="vmw-iv-dashboard-subsection">
            <h3 className="vmw-iv-dashboard-subtitle"><LuNetwork className="vmw-iv-dashboard-icon" /> {copy.tabs.networkVmware}</h3>
            <FilterInput placeholder={copy.filterNetwork} value={filterNetworks} onChange={setFilterNetworks} />
            <div className="vmw-iv-dashboard-grid pgroup">
              {networkCards
                .filter(net => [net.iface, net.node, net.type, net.ports, net.vlanAware, net.uplink].join(" ").toLowerCase().includes(filterNetworks.toLowerCase()))
                .map(net => (
                  <div key={`${net.node}-${net.iface}`} className="vmw-iv-dashboard-card pgroup">
                    <h3><TbCloudNetwork className="vmw-iv-dashboard-icon" /> {net.iface}</h3>
                    <p><strong>VLAN:</strong> {net.vlanAware}</p>
                    <p><strong>{copy.node}:</strong> {net.node}</p>
                    <p><strong>Parent Switch:</strong> {net.ports}</p>
                    <p><strong>{copy.type}:</strong> {net.type}</p>
                    <p><strong>Uplinks:</strong> {net.uplink}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── MARGINS ── */}
        {activeTab === 'margins' && (
          <div className="vmw-iv-dashboard-subsection">
            <h3 className="vmw-iv-dashboard-subtitle"><TbServerCog className="vmw-iv-dashboard-icon" />{copy.marginTitle} +{marginInfra}%</h3>
            <div className="vmw-iv-dashboard-filtergroup">
              <select className="vmw-iv-dashboard-select" value={marginInfra} onChange={e => setMarginInfra(e.target.value)}>
                <option value="10">10%</option><option value="20">20%</option><option value="30">30%</option>
              </select>
              <h4><GrConfigure className="vmw-iv-dashboard-icon" />{copy.marginSelect}</h4>
            </div>
            <div className="vmw-iv-dashboard-grid margin">
              <div className="vmw-iv-dashboard-card"><h3><TbCpuOff className="vmw-iv-dashboard-icon" />vCPU({copy.totalShort})</h3><p>{resources?.cpu?.vcpu_total ?? summary?.compute?.total?.vcpus ?? "N/D"}</p></div>
              <div className="vmw-iv-dashboard-card"><h3><PiCpu className="vmw-iv-dashboard-icon" />Ghz({copy.totalShort})</h3><p>{summary?.compute?.total?.ghzDisplay || totalGhz}</p></div>
              <div className="vmw-iv-dashboard-card"><h3><BsMemory className="vmw-iv-dashboard-icon" />RAM({copy.totalShort})</h3><p>{resources?.ram?.total || summary?.compute?.total?.ramDisplay || "N/D"}</p></div>
              <div className="vmw-iv-dashboard-card"><h3><BsDeviceHdd className="vmw-iv-dashboard-icon" />Storage({copy.totalShort})</h3><p>{resources?.storage?.total || summary?.compute?.total?.storageDisplay || "N/D"}</p></div>
            </div>
            <div className="vmw-iv-dashboard-grid margin">
              <div className="vmw-iv-dashboard-card"><h3><TbCpuOff className="vmw-iv-dashboard-icon" />vCPU({copy.inUse})</h3><p>{usedVcpus}</p></div>
              <div className="vmw-iv-dashboard-card"><h3><PiCpu className="vmw-iv-dashboard-icon" />Ghz({copy.inUse})</h3><p>{summary?.compute?.used?.ghzDisplay || usedGhz}</p></div>
              <div className="vmw-iv-dashboard-card"><h3><BsMemory className="vmw-iv-dashboard-icon" />RAM({copy.inUse})</h3><p>{usedRam}</p></div>
              <div className="vmw-iv-dashboard-card"><h3><BsDeviceHdd className="vmw-iv-dashboard-icon" />Storage({copy.inUse})</h3><p>{usedStorage}</p></div>
            </div>
            <div className="vmw-iv-dashboard-grid margin">
              <div className="vmw-iv-dashboard-card"><h3><TbCpuOff className="vmw-iv-dashboard-icon" />vCPU+{marginInfra}%</h3><p>{vCpuWithMargin}</p></div>
              <div className="vmw-iv-dashboard-card"><h3><PiCpu className="vmw-iv-dashboard-icon" />Ghz+{marginInfra}%</h3><p>{ghzWithMargin}</p></div>
              <div className="vmw-iv-dashboard-card"><h3><BsMemory className="vmw-iv-dashboard-icon" />RAM+{marginInfra}%</h3><p>{ramWithMargin}</p></div>
              <div className="vmw-iv-dashboard-card"><h3><BsDeviceHdd className="vmw-iv-dashboard-icon" />Storage+{marginInfra}%</h3><p>{storageWithMargin}</p></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VMwareInfraDash;

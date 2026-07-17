import { useMemo, useState } from "react";

import { GoInfo } from "react-icons/go";
import { HiOutlineBadgeCheck } from "react-icons/hi";
import { LuDatabase, LuNetwork, LuServer, LuTvMinimalPlay, LuContainer } from "react-icons/lu";
import { PiComputerTowerLight, PiCpu } from "react-icons/pi";
import { BsMemory, BsDeviceHdd } from "react-icons/bs";
import { TbServerCog, TbCloudNetwork, TbCpu2, TbNetwork, TbPhotoSensor2, TbCpuOff } from "react-icons/tb";
import { SiProxmox } from "react-icons/si";
import { LiaNetworkWiredSolid } from "react-icons/lia";
import { BiSolidReport } from "react-icons/bi";
import { GrConfigure } from "react-icons/gr";
import { getUiText } from '../lib/uiText';

const TABS = [
  { id: 'datacenter', labelKey: 'datacenter', Icon: TbServerCog },
  { id: 'vm',         labelKey: 'vm',         Icon: LuTvMinimalPlay },
  { id: 'lxc',        labelKey: 'lxc',        Icon: LuContainer },
  { id: 'nodes',      labelKey: 'nodes',      Icon: PiComputerTowerLight },
  { id: 'storage',    labelKey: 'storage',    Icon: LuDatabase },
  { id: 'network',    labelKey: 'network',    Icon: LuNetwork },
  { id: 'margins',    labelKey: 'margins',    Icon: GrConfigure },
];

const ProxmoxInfraDash = ({ data, handleReset, language = 'it' }) => {
  const [activeTab, setActiveTab]           = useState('datacenter');
  const [filterNodes, setFilterNodes]       = useState("");
  const [filterVms, setFilterVms]           = useState("");
  const [filterLxcs, setFilterLxcs]         = useState("");
  const [filterStorages, setFilterStorages] = useState("");
  const [filterNetworks, setFilterNetworks] = useState("");
  const [filterZones, setFilterZones]       = useState("");
  const [filterVnets, setFilterVnets]       = useState("");
  const [filterSubnets, setFilterSubnets]   = useState("");
  const [marginInfra, setMarginInfra]       = useState("10");
  const { common, infraDashboard: copy } = getUiText(language);

  const datacenter  = data?.datacenter || {};
  const cluster     = datacenter?.cluster || {};
  const hasCluster  = Object.keys(cluster).length > 0;
  const resources   = datacenter?.resources || {};
  const version     = datacenter?.version || {};
  const nodes       = Array.isArray(data?.nodes)    ? data.nodes    : [];
  const vms         = Array.isArray(data?.vm)       ? data.vm       : [];
  const lxcs        = Array.isArray(data?.lxc)      ? data.lxc      : [];
  const storages    = Array.isArray(data?.storages) ? data.storages : [];
  const sdn         = data?.sdn || {};

  const runningVMs   = vms.filter(v => v.status === "running").length;
  const stoppedVMs   = vms.filter(v => v.status !== "running").length;
  const templateVMs  = vms.filter(v => v.template === true).length;
  const runningLXCs  = lxcs.filter(l => l.status === "running").length;
  const stoppedLXCs  = lxcs.filter(l => l.status !== "running").length;
  const templateLXCs = lxcs.filter(l => l.template === true).length;
  const totalVmCpu   = vms.reduce((s, v) => s + (Number(v.cpu) || 0), 0);
  const totalVmRamGb = vms.reduce((s, v) => s + (Number(v?.ram?.gb) || 0), 0);
  const totalLxcCpu  = lxcs.reduce((s, l) => s + (Number(l.cpu) || 0), 0);
  const totalLxcRamGb = lxcs.reduce((s, l) => s + (Number(l?.ram?.gb) || 0), 0);
  const totalCores   = Number(resources?.cpu?.core_total) || 0;
  const usedCores    = Number(resources?.cpu?.core_used) || 0;
  const usedVcpus    = resources?.cpu?.core_used ?? "N/D";
  const usedRam      = resources?.ram?.used ?? "N/D";
  const usedStorage  = resources?.storage?.used ?? "N/D";
  const totalGhz     = nodes.reduce((s, n) => s + ((Number(n?.resources?.cpu?.core_total) || 0) * (Number(n?.hardware?.ghz) || 0)), 0);
  const usedGhz      = totalCores > 0 && totalGhz > 0 ? Number((totalGhz * (usedCores / totalCores)).toFixed(2)) : 0;

  const totalVmDiskGb = vms.reduce((sum, item) => {
    const disks = Array.isArray(item.disks) ? item.disks : [];
    return sum + disks.reduce((ds, disk) => {
      if (typeof disk.sizeGB === "number") return ds + disk.sizeGB;
      if (typeof disk.sizeMB === "number") return ds + disk.sizeMB / 1024;
      return ds;
    }, 0);
  }, 0);
  const totalLxcDiskGb = lxcs.reduce((s, l) => s + (Number(l?.disk?.gb) || 0), 0);

  const formatDiskTotal = (gb) => {
    if (!Number.isFinite(gb) || gb <= 0) return "0 GB";
    return gb >= 1000 ? `${(gb / 1024).toFixed(2)} TB` : `${gb.toFixed(2)} GB`;
  };

  const networkCards = useMemo(() => {
    const map = new Map();
    nodes.forEach(node => {
      (node?.network?.bridges || []).forEach(bridge => {
        map.set(`${node.name}-${bridge.iface}`, {
          node: node.name,
          iface: bridge.iface || "N/D",
          ports: bridge.ports || "N/D",
          vlanAware: bridge.vlan_aware == null ? "N/D" : String(bridge.vlan_aware),
          gateway: node?.network?.management?.gateway || "N/D",
          address: node?.network?.management?.cidr || node?.network?.management?.address || "N/D",
          type: "bridge",
        });
      });
    });
    return Array.from(map.values());
  }, [nodes]);

  const parseSizeToGiB = (value) => {
    if (!value || typeof value !== "string") return null;
    const match = value.trim().match(/^([\d.]+)\s*(KiB|MiB|GiB|TiB|PiB)$/i);
    if (!match) return null;
    const num = parseFloat(match[1]);
    const factors = { KIB: 1/(1024*1024), MIB: 1/1024, GIB: 1, TIB: 1024, PIB: 1024*1024 };
    return num * factors[match[2].toUpperCase()];
  };
  const formatGiB = (v) =>
    v == null || isNaN(v) ? "N/D" : v >= 1024 ? `${(v/1024).toFixed(2)} TiB` : `${v.toFixed(2)} GiB`;
  const applyMargin = (value, m) => {
    const num = Number(value);
    return isNaN(num) ? "N/D" : (num * (1 + Number(m) / 100)).toFixed(2);
  };
  const usedRamGiB      = parseSizeToGiB(usedRam);
  const usedStorageGiB  = parseSizeToGiB(usedStorage);
  const vCpuWithMargin  = applyMargin(usedVcpus, marginInfra);
  const ramWithMargin   = usedRamGiB      != null ? formatGiB(usedRamGiB     * (1 + Number(marginInfra)/100)) : "N/D";
  const storageWithMargin = usedStorageGiB != null ? formatGiB(usedStorageGiB * (1 + Number(marginInfra)/100)) : "N/D";
  const ghzWithMargin   = Number(applyMargin(usedGhz, marginInfra));

  const FilterInput = ({ placeholder, value, onChange }) => (
    <div className="pmx-iv-dashboard-filtergroup">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pmx-iv-dashboard-filter-input"
      />
    </div>
  );

  const EmptyCard = () => (
    <div className="pmx-iv-dashboard-card pgroup"><p>{copy.noConfig}</p></div>
  );

  return (
    <div className="pmx-iv-dashboard-container">

      <h2 className="pmx-iv-dashboard-title">
        <SiProxmox className="pmx-iv-dashboard-icon title" />
        {datacenter?.node || "InfrastructureView"}
      </h2>
      <h3 className="pmx-iv-dashboard-subtitle pmxtools">
        <TbPhotoSensor2 className="pmx-iv-dashboard-icon pmxtools" />
        pmxtools: {data?.pmxtools || "N/D"} — report {data?.report || "N/D"}
      </h3>

      <div className="pmx-iv-dashboard-tabbar">
        <button className="pmx-iv-dashboard-btn-secondary" onClick={handleReset}>
          <BiSolidReport className="pmx-iv-dashboard-icon mini" />
          {copy.loadAnother}
        </button>
        <div className="pmx-iv-tabnav-sep" aria-hidden="true" />
        <nav className="pmx-iv-tabnav">
          {TABS.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              className={`pmx-iv-tabnav-btn${activeTab === id ? ' active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon className="pmx-iv-dashboard-icon mini" />
              {copy.tabs[labelKey]}
            </button>
          ))}
        </nav>
      </div>

      <h3 className="pmx-iv-dashboard-subtitle">
        <GoInfo className="pmx-iv-dashboard-icon" />{copy.generalInfo}
      </h3>
      <div className="pmx-iv-dashboard-grid gnr">
        <div className="pmx-iv-dashboard-card gnr"><h3><HiOutlineBadgeCheck className="pmx-iv-dashboard-icon" />{copy.datacenterType}</h3><p>{datacenter?.type || "N/D"}</p></div>
        <div className="pmx-iv-dashboard-card gnr"><h3><PiComputerTowerLight className="pmx-iv-dashboard-icon" />{copy.primaryNode}</h3><p>{datacenter?.node || "N/D"}</p></div>
        <div className="pmx-iv-dashboard-card gnr"><h3><LuServer className="pmx-iv-dashboard-icon" />{copy.pveVersion}</h3><p>{version?.version || "N/D"}</p></div>
        <div className="pmx-iv-dashboard-card gnr"><h3><LuServer className="pmx-iv-dashboard-icon" />{copy.release}</h3><p>{version?.release || "N/D"}</p></div>
        <div className="pmx-iv-dashboard-card gnr"><h3><PiComputerTowerLight className="pmx-iv-dashboard-icon" />{copy.totalNodes}</h3><p>{nodes.length}</p></div>
        <div className="pmx-iv-dashboard-card gnr"><h3><LuTvMinimalPlay className="pmx-iv-dashboard-icon" />{copy.totalVms}</h3><p>{vms.length}</p></div>
        <div className="pmx-iv-dashboard-card gnr"><h3><LuContainer className="pmx-iv-dashboard-icon" />{copy.totalLxcs}</h3><p>{lxcs.length}</p></div>
        <div className="pmx-iv-dashboard-card gnr"><h3><LuDatabase className="pmx-iv-dashboard-icon" />{copy.totalStorages}</h3><p>{storages.length}</p></div>
        <div className="pmx-iv-dashboard-card gnr"><h3><TbCloudNetwork className="pmx-iv-dashboard-icon" />{copy.totalNetworks}</h3><p>{networkCards.length}</p></div>
      </div>

      <div key={activeTab} className="pmx-iv-tabcontent">

        {/* ── DATACENTER ── */}
        {activeTab === 'datacenter' && (
          <>
            <div className="pmx-iv-dashboard-subsection">
              <h3 className="pmx-iv-dashboard-subtitle"><TbServerCog className="pmx-iv-dashboard-icon" />{copy.resourceSummary}</h3>
              <div className="pmx-iv-dashboard-grid computehd">
                <div className="pmx-iv-dashboard-card compute"><h3><TbCpu2 className="pmx-iv-dashboard-icon" />Core {copy.totalShort}</h3><p>{resources?.cpu?.core_total ?? "N/D"}</p></div>
                <div className="pmx-iv-dashboard-card compute"><h3><BsMemory className="pmx-iv-dashboard-icon" />RAM {copy.totalShort}</h3><p>{resources?.ram?.total || "N/D"}</p></div>
                <div className="pmx-iv-dashboard-card compute"><h3><BsDeviceHdd className="pmx-iv-dashboard-icon" />Storage {copy.totalShort}</h3><p>{resources?.storage?.total || "N/D"}</p></div>
              </div>
              <div className="pmx-iv-dashboard-grid computehd">
                <div className="pmx-iv-dashboard-card compute"><h3><TbCpu2 className="pmx-iv-dashboard-icon" />Core {copy.inUse}</h3><p>{resources?.cpu?.core_used ?? "N/D"}</p></div>
                <div className="pmx-iv-dashboard-card compute"><h3><BsMemory className="pmx-iv-dashboard-icon" />RAM {copy.inUse}</h3><p>{resources?.ram?.used || "N/D"}</p></div>
                <div className="pmx-iv-dashboard-card compute"><h3><BsDeviceHdd className="pmx-iv-dashboard-icon" />Storage {copy.inUse}</h3><p>{resources?.storage?.used || "N/D"}</p></div>
              </div>
              <div className="pmx-iv-dashboard-grid computehd">
                <div className="pmx-iv-dashboard-card compute"><h3><TbCpu2 className="pmx-iv-dashboard-icon" />% Core</h3><p>{resources?.cpu?.percentage ?? "N/D"} %</p></div>
                <div className="pmx-iv-dashboard-card compute"><h3><BsMemory className="pmx-iv-dashboard-icon" />% RAM</h3><p>{resources?.ram?.percentage || "N/D"} %</p></div>
                <div className="pmx-iv-dashboard-card compute"><h3><BsDeviceHdd className="pmx-iv-dashboard-icon" />% Storage</h3><p>{resources?.storage?.percentage || "N/D"} %</p></div>
              </div>
            </div>
            {hasCluster && (
              <div className="pmx-iv-dashboard-subsection">
                <h3 className="pmx-iv-dashboard-subtitle"><TbServerCog className="pmx-iv-dashboard-icon" />{copy.clusterSummary}</h3>
                <div className="pmx-iv-dashboard-grid computehd">
                  <div className="pmx-iv-dashboard-card compute"><h3><TbServerCog className="pmx-iv-dashboard-icon" />{copy.clusterName}</h3><p>{cluster?.name || "N/D"}</p></div>
                  <div className="pmx-iv-dashboard-card compute"><h3><LuNetwork className="pmx-iv-dashboard-icon" />{copy.version}</h3><p>{cluster?.version ?? "N/D"}</p></div>
                  <div className="pmx-iv-dashboard-card compute"><h3><LuServer className="pmx-iv-dashboard-icon" />{copy.configuredNodes}</h3><p>{cluster?.configured_nodes ?? "N/D"}</p></div>
                </div>
                <div className="pmx-iv-dashboard-grid computehd">
                  <div className="pmx-iv-dashboard-card compute"><h3><HiOutlineBadgeCheck className="pmx-iv-dashboard-icon" />{copy.quorum}</h3><p>{cluster?.has_quorum ? copy.present : copy.absent}</p></div>
                  <div className="pmx-iv-dashboard-card compute"><h3><LuServer className="pmx-iv-dashboard-icon" />{copy.onlineNodes}</h3><p>{Array.isArray(cluster?.nodes) ? cluster.nodes.filter(n => n?.online).length : "N/D"}</p></div>
                  <div className="pmx-iv-dashboard-card compute"><h3><GoInfo className="pmx-iv-dashboard-icon" />{copy.localNode}</h3><p>{Array.isArray(cluster?.nodes) ? cluster.nodes.find(n => n?.local_node)?.name || "N/D" : "N/D"}</p></div>
                </div>
                <div className="pmx-iv-dashboard-grid computehd">
                  {(cluster?.nodes || []).map((node, i) => (
                    <div key={`${node?.name || "node"}-${i}`} className="pmx-iv-dashboard-card compute">
                      <h3><SiProxmox className="pmx-iv-dashboard-icon" />{node?.name || `${copy.nodeFallback} ${i + 1}`}</h3>
                      <p>{copy.id}: {node?.nodeid ?? "N/D"}</p>
                      <p>{copy.ip}: {node?.ip || "N/D"}</p>
                      <p>{copy.status}: {node?.online ? common.online : common.offline}</p>
                      <p>{copy.role}: {node?.local_node ? copy.local : copy.remote}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── VM ── */}
        {activeTab === 'vm' && (
          <>
            <div className="pmx-iv-dashboard-subsection">
              <h3 className="pmx-iv-dashboard-subtitle"><LuTvMinimalPlay className="pmx-iv-dashboard-icon" />{copy.vmSummary}</h3>
              <div className="pmx-iv-dashboard-grid vms">
                <div className="pmx-iv-dashboard-card"><h3><LuTvMinimalPlay className="pmx-iv-dashboard-icon" />{copy.totalVms}</h3><p>{vms.length}</p></div>
                <div className="pmx-iv-dashboard-card"><h3><HiOutlineBadgeCheck className="pmx-iv-dashboard-icon" />{copy.running}</h3><p>{runningVMs}</p></div>
                <div className="pmx-iv-dashboard-card"><h3><TbCpuOff className="pmx-iv-dashboard-icon" />{copy.stopped}</h3><p>{stoppedVMs}</p></div>
                <div className="pmx-iv-dashboard-card"><h3><TbPhotoSensor2 className="pmx-iv-dashboard-icon" />{copy.template}</h3><p>{templateVMs}</p></div>
                <div className="pmx-iv-dashboard-card"><h3><PiCpu className="pmx-iv-dashboard-icon" />{copy.totalVcpu}</h3><p>{totalVmCpu}</p></div>
                <div className="pmx-iv-dashboard-card"><h3><BsMemory className="pmx-iv-dashboard-icon" />{copy.totalRam}</h3><p>{totalVmRamGb} GB</p></div>
                <div className="pmx-iv-dashboard-card"><h3><BsDeviceHdd className="pmx-iv-dashboard-icon" />{copy.totalDisk}</h3><p>{formatDiskTotal(totalVmDiskGb)}</p></div>
              </div>
            </div>
            <div className="pmx-iv-dashboard-subsection">
              <h3 className="pmx-iv-dashboard-subtitle"><LuTvMinimalPlay className="pmx-iv-dashboard-icon" />{copy.vmView}</h3>
              <FilterInput placeholder={copy.filterVm} value={filterVms} onChange={setFilterVms} />
              <div className="pmx-iv-table-container">
                <table className="pmx-iv-table">
                  <thead><tr>
                    <th>{copy.id}</th><th>{copy.name}</th><th>{copy.node}</th><th>{copy.status}</th><th>{copy.template}</th>
                    <th>vCPU</th><th>RAM</th><th>{copy.primaryDisk}</th><th>{copy.primaryNetwork}</th><th>Tags</th><th>{copy.notes}</th>
                  </tr></thead>
                  <tbody>
                    {vms
                      .filter(vm => [vm.id, vm.name, vm.node, vm.status, vm.template ? "yes" : "no", vm.cpu, vm.notes || "—", vm.tags || ""].join(" ").toLowerCase().includes(filterVms.toLowerCase()))
                      .map(vm => {
                        const fd = vm?.disks?.find(d => !d?.volume?.toLowerCase().includes("cloudinit"));
                        const diskStr = !fd ? "N/D" : fd.sizeTB ? `${fd.sizeTB} TB` : fd.sizeGB ? `${fd.sizeGB} GB` : fd.sizeMB ? `${fd.sizeMB} MB` : "N/D";
                        const netStr = Array.isArray(vm.network) && vm.network.length > 0
                          ? vm.network.map(n => `${n.bridge}${n.ips?.length ? ` — ${n.ips.join(", ")}` : ""}`).join(" | ")
                          : "N/D";
                        const tagList = vm.tags ? String(vm.tags).split(';').map(t => t.trim()).filter(Boolean) : [];
                        return (
                          <tr key={vm.id}>
                            <td>{vm.id}</td><td>{vm.name}</td><td>{vm.node}</td>
                            <td>{vm.status}</td><td>{vm.template ? common.yes : common.no}</td>
                            <td>{vm.cpu ?? "N/D"}</td>
                            <td>{vm?.ram?.gb ? `${vm.ram.gb} GB` : "N/D"}</td>
                            <td>{diskStr}</td><td>{netStr}</td>
                            <td>{tagList.length > 0 ? (
                              <div className="pmx-iv-tags">{tagList.map(t => <span key={t} className="pmx-iv-tag">{t}</span>)}</div>
                            ) : "—"}</td>
                            <td>{vm.notes || "—"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── LXC ── */}
        {activeTab === 'lxc' && (
          <>
            <div className="pmx-iv-dashboard-subsection">
              <h3 className="pmx-iv-dashboard-subtitle"><LuContainer className="pmx-iv-dashboard-icon" />{copy.lxcSummary}</h3>
              <div className="pmx-iv-dashboard-grid vms">
                <div className="pmx-iv-dashboard-card"><h3><LuContainer className="pmx-iv-dashboard-icon" />{copy.totalLxcs}</h3><p>{lxcs.length}</p></div>
                <div className="pmx-iv-dashboard-card"><h3><HiOutlineBadgeCheck className="pmx-iv-dashboard-icon" />{copy.running}</h3><p>{runningLXCs}</p></div>
                <div className="pmx-iv-dashboard-card"><h3><TbCpuOff className="pmx-iv-dashboard-icon" />{copy.stopped}</h3><p>{stoppedLXCs}</p></div>
                <div className="pmx-iv-dashboard-card"><h3><TbPhotoSensor2 className="pmx-iv-dashboard-icon" />{copy.template}</h3><p>{templateLXCs}</p></div>
                <div className="pmx-iv-dashboard-card"><h3><PiCpu className="pmx-iv-dashboard-icon" />{copy.totalVcpu}</h3><p>{totalLxcCpu}</p></div>
                <div className="pmx-iv-dashboard-card"><h3><BsMemory className="pmx-iv-dashboard-icon" />{copy.totalRam}</h3><p>{totalLxcRamGb} GB</p></div>
                <div className="pmx-iv-dashboard-card"><h3><BsDeviceHdd className="pmx-iv-dashboard-icon" />{copy.totalDisk}</h3><p>{formatDiskTotal(totalLxcDiskGb)}</p></div>
              </div>
            </div>
            <div className="pmx-iv-dashboard-subsection">
              <h3 className="pmx-iv-dashboard-subtitle"><LuContainer className="pmx-iv-dashboard-icon" />{copy.lxcView}</h3>
              <FilterInput placeholder={copy.filterLxc} value={filterLxcs} onChange={setFilterLxcs} />
              <div className="pmx-iv-table-container">
                <table className="pmx-iv-table">
                  <thead><tr>
                    <th>{copy.id}</th><th>{copy.name}</th><th>{copy.node}</th><th>{copy.status}</th><th>{copy.template}</th>
                    <th>vCPU</th><th>RAM</th><th>{copy.primaryDisk}</th><th>{copy.primaryNetwork}</th><th>Tags</th><th>{copy.notes}</th>
                  </tr></thead>
                  <tbody>
                    {lxcs
                      .filter(lxc => [lxc.id, lxc.name, lxc.node, lxc.status, lxc.template ? "yes" : "no", lxc.cpu, lxc.notes?.trim() || "—", lxc.tags || ""].join(" ").toLowerCase().includes(filterLxcs.toLowerCase()))
                      .map(lxc => {
                        const diskStr = lxc?.disk?.tb ? `${lxc.disk.tb} TB` : lxc?.disk?.gb ? `${lxc.disk.gb} GB` : lxc?.disk?.mb ? `${lxc.disk.mb} MB` : "N/D";
                        const netStr = Array.isArray(lxc.network) && lxc.network.length > 0
                          ? lxc.network.map(n => `${n.bridge}${n.ips?.length ? ` — ${n.ips.join(", ")}` : ""}`).join(" | ")
                          : "N/D";
                        const tagList = lxc.tags ? String(lxc.tags).split(';').map(t => t.trim()).filter(Boolean) : [];
                        return (
                          <tr key={lxc.id}>
                            <td>{lxc.id}</td><td>{lxc.name}</td><td>{lxc.node}</td>
                            <td>{lxc.status}</td><td>{lxc.template ? common.yes : common.no}</td>
                            <td>{lxc.cpu ?? "N/D"}</td>
                            <td>{lxc?.ram?.gb ? `${lxc.ram.gb} GB` : "N/D"}</td>
                            <td>{diskStr}</td><td>{netStr}</td>
                            <td>{tagList.length > 0 ? (
                              <div className="pmx-iv-tags">{tagList.map(t => <span key={t} className="pmx-iv-tag">{t}</span>)}</div>
                            ) : "—"}</td>
                            <td>{lxc.notes?.trim() || "—"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── NODES ── */}
        {activeTab === 'nodes' && (
          <div className="pmx-iv-dashboard-subsection">
            <h3 className="pmx-iv-dashboard-subtitle"><PiComputerTowerLight className="pmx-iv-dashboard-icon" />{copy.nodesView}</h3>
            <FilterInput placeholder={copy.filterNodes} value={filterNodes} onChange={setFilterNodes} />
            <div className="pmx-iv-dashboard-grid">
              {nodes
                .filter(node => [
                  node.name, node.status, node.version, node.release, node.uptime,
                  node?.hardware?.cpu, node?.hardware?.sockets, node?.hardware?.cores,
                  node?.hardware?.threads, node?.hardware?.ghz, node?.hardware?.ram,
                  node?.network?.management?.cidr, node?.network?.management?.gateway,
                ].join(" ").toLowerCase().includes(filterNodes.toLowerCase()))
                .map(node => (
                  <div key={node.name} className="pmx-iv-dashboard-card pmxnode">
                    <h3><SiProxmox className="pmx-iv-dashboard-icon" />{node.name}</h3>
                    <p><strong>{copy.status}:</strong> {node.status || "N/D"}</p>
                    <p><strong>{copy.version}:</strong> {node.version || "N/D"}</p>
                    <p><strong>{copy.release}:</strong> {node.release || "N/D"}</p>
                    <p><strong>{copy.uptime}:</strong> {node.uptime || "N/D"}</p>
                    <p><strong>CPU:</strong> {node?.hardware?.cpu || "N/D"}</p>
                    <p><strong>{copy.socket}:</strong> {node?.hardware?.sockets ?? "N/D"}</p>
                    <p><strong>{copy.core}:</strong> {node?.hardware?.cores ?? "N/D"}</p>
                    <p><strong>{copy.thread}:</strong> {node?.hardware?.threads ?? "N/D"}</p>
                    <p><strong>{copy.clock}:</strong> {node?.hardware?.ghz ? `${node.hardware.ghz} GHz` : "N/D"}</p>
                    <p><strong>RAM:</strong> {node?.hardware?.ram || "N/D"}</p>
                    <p><strong>{copy.management}:</strong> {node?.network?.management?.cidr || "N/D"}</p>
                    <p><strong>{copy.gateway}:</strong> {node?.network?.management?.gateway || "N/D"}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── STORAGE ── */}
        {activeTab === 'storage' && (
          <div className="pmx-iv-dashboard-subsection">
            <h3 className="pmx-iv-dashboard-subtitle"><LuDatabase className="pmx-iv-dashboard-icon" />{copy.storageTitle}</h3>
            <FilterInput placeholder={copy.filterStorage} value={filterStorages} onChange={setFilterStorages} />
            <div className="pmx-iv-dashboard-grid">
              {storages
                .filter(s => [s.name, s.type, s.node, String(s.shared), s.total, s.used, s.free].join(" ").toLowerCase().includes(filterStorages.toLowerCase()))
                .map(s => (
                  <div key={`${s.node}-${s.name}`} className="pmx-iv-dashboard-card ds">
                    <h3><LuDatabase className="pmx-iv-dashboard-icon" />{s.name}</h3>
                    <p><strong>{copy.type}:</strong> {s.type || "N/D"}</p>
                    <p><strong>{copy.node}:</strong> {s.node || "N/D"}</p>
                    <p><strong>{copy.shared}:</strong> {String(s.shared)}</p>
                    <p><strong>{copy.total}:</strong> {s.total || "N/D"}</p>
                    <p><strong>{copy.used}:</strong> {s.used || "N/D"}</p>
                    <p><strong>{copy.free}:</strong> {s.free || "N/D"}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── NETWORK & SDN ── */}
        {activeTab === 'network' && (
          <>
            <div className="pmx-iv-dashboard-subsection">
              <h3 className="pmx-iv-dashboard-subtitle"><LuNetwork className="pmx-iv-dashboard-icon" />{copy.networkBridge}</h3>
              <FilterInput placeholder={copy.filterNetwork} value={filterNetworks} onChange={setFilterNetworks} />
              <div className="pmx-iv-dashboard-grid pgroup">
                {networkCards
                  .filter(net => [net.iface, net.node, net.type, net.ports, net.address, net.gateway, net.vlanAware].join(" ").toLowerCase().includes(filterNetworks.toLowerCase()))
                  .map(net => (
                    <div key={`${net.node}-${net.iface}`} className="pmx-iv-dashboard-card pgroup">
                      <h3><TbCloudNetwork className="pmx-iv-dashboard-icon" />{net.iface}</h3>
                      <p><strong>{copy.node}:</strong> {net.node}</p>
                      <p><strong>{copy.type}:</strong> {net.type}</p>
                      <p><strong>{copy.ports}:</strong> {net.ports}</p>
                      <p><strong>{copy.address}:</strong> {net.address}</p>
                      <p><strong>{copy.gateway}:</strong> {net.gateway}</p>
                      <p><strong>{copy.vlanAware}:</strong> {net.vlanAware}</p>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pmx-iv-dashboard-subsection">
              <h3 className="pmx-iv-dashboard-subtitle"><LiaNetworkWiredSolid className="pmx-iv-dashboard-icon" />{copy.zones}</h3>
              <FilterInput placeholder={copy.filterZones} value={filterZones} onChange={setFilterZones} />
              <div className="pmx-iv-dashboard-grid pgroup">
                {(() => {
                  const f = (sdn?.zones || []).filter(z => [z.zone, z.type, z.bridge, z.ipam].join(" ").toLowerCase().includes(filterZones.toLowerCase()));
                  return f.length ? f.map((z, i) => (
                    <div key={`${z.zone}-${i}`} className="pmx-iv-dashboard-card pgroup">
                      <h3><LiaNetworkWiredSolid className="pmx-iv-dashboard-icon" />{z.zone}</h3>
                      <p><strong>{copy.type}:</strong> {z.type}</p>
                      <p><strong>{copy.bridge}:</strong> {z.bridge}</p>
                      <p><strong>{copy.ipam}:</strong> {z.ipam}</p>
                    </div>
                  )) : [<EmptyCard key="empty" />];
                })()}
              </div>
            </div>

            <div className="pmx-iv-dashboard-subsection">
              <h3 className="pmx-iv-dashboard-subtitle"><TbCloudNetwork className="pmx-iv-dashboard-icon" />{copy.vnets}</h3>
              <FilterInput placeholder={copy.filterVnets} value={filterVnets} onChange={setFilterVnets} />
              <div className="pmx-iv-dashboard-grid pgroup">
                {(() => {
                  const f = (sdn?.vnets || []).filter(v => [v.vnet, v.alias, v.zone, v.tag, v.type].join(" ").toLowerCase().includes(filterVnets.toLowerCase()));
                  return f.length ? f.map((v, i) => (
                    <div key={`${v.vnet}-${i}`} className="pmx-iv-dashboard-card pgroup">
                      <h3><TbCloudNetwork className="pmx-iv-dashboard-icon" />{v.vnet}</h3>
                      <p><strong>{copy.alias}:</strong> {v.alias}</p>
                      <p><strong>{copy.zone}:</strong> {v.zone}</p>
                      <p><strong>{copy.tag}:</strong> {v.tag}</p>
                      <p><strong>{copy.type}:</strong> {v.type}</p>
                    </div>
                  )) : [<EmptyCard key="empty" />];
                })()}
              </div>
            </div>

            <div className="pmx-iv-dashboard-subsection">
              <h3 className="pmx-iv-dashboard-subtitle"><TbNetwork className="pmx-iv-dashboard-icon" />{copy.subnet}</h3>
              <FilterInput placeholder={copy.filterSubnet} value={filterSubnets} onChange={setFilterSubnets} />
              <div className="pmx-iv-dashboard-grid pgroup">
                {(() => {
                  const f = (sdn?.subnets || []).filter(s => [s.subnet, s.gateway, s.snat, s.vnet].join(" ").toLowerCase().includes(filterSubnets.toLowerCase()));
                  return f.length ? f.map((s, i) => (
                    <div key={`${s.subnet}-${i}`} className="pmx-iv-dashboard-card pgroup">
                      <h3><TbNetwork className="pmx-iv-dashboard-icon" />{s.subnet}</h3>
                      <p><strong>{copy.gateway}:</strong> {s.gateway}</p>
                      <p><strong>{copy.snat}:</strong> {s.snat}</p>
                      <p><strong>VNet:</strong> {s.vnet}</p>
                    </div>
                  )) : [<EmptyCard key="empty" />];
                })()}
              </div>
            </div>
          </>
        )}

        {/* ── MARGINS ── */}
        {activeTab === 'margins' && (
          <div className="pmx-iv-dashboard-subsection">
            <h3 className="pmx-iv-dashboard-subtitle"><GrConfigure className="pmx-iv-dashboard-icon" />{copy.marginTitle} +{marginInfra}%</h3>
            <div className="pmx-iv-dashboard-filtergroup">
              <select className="pmx-iv-dashboard-select" value={marginInfra} onChange={e => setMarginInfra(e.target.value)}>
                <option value="10">10%</option>
                <option value="20">20%</option>
                <option value="30">30%</option>
              </select>
              <h4><GrConfigure className="pmx-iv-dashboard-icon" />{copy.marginSelect}</h4>
            </div>
            <div className="pmx-iv-dashboard-grid margin">
              <div className="pmx-iv-dashboard-card"><h3><TbCpuOff className="pmx-iv-dashboard-icon" />Core({copy.totalShort})</h3><p>{resources?.cpu?.core_total ?? "N/D"}</p></div>
              <div className="pmx-iv-dashboard-card"><h3><TbCpuOff className="pmx-iv-dashboard-icon" />Ghz({copy.totalShort})</h3><p>{totalGhz}</p></div>
              <div className="pmx-iv-dashboard-card"><h3><BsMemory className="pmx-iv-dashboard-icon" />RAM({copy.totalShort})</h3><p>{resources?.ram?.total || "N/D"}</p></div>
              <div className="pmx-iv-dashboard-card"><h3><BsDeviceHdd className="pmx-iv-dashboard-icon" />Storage({copy.totalShort})</h3><p>{resources?.storage?.total || "N/D"}</p></div>
            </div>
            <div className="pmx-iv-dashboard-grid margin">
              <div className="pmx-iv-dashboard-card"><h3><TbCpuOff className="pmx-iv-dashboard-icon" />Core({copy.inUse})</h3><p>{usedVcpus}</p></div>
              <div className="pmx-iv-dashboard-card"><h3><TbCpuOff className="pmx-iv-dashboard-icon" />Ghz({copy.inUse})</h3><p>{usedGhz}</p></div>
              <div className="pmx-iv-dashboard-card"><h3><BsMemory className="pmx-iv-dashboard-icon" />RAM({copy.inUse})</h3><p>{usedRam}</p></div>
              <div className="pmx-iv-dashboard-card"><h3><BsDeviceHdd className="pmx-iv-dashboard-icon" />Storage({copy.inUse})</h3><p>{usedStorage}</p></div>
            </div>
            <div className="pmx-iv-dashboard-grid margin">
              <div className="pmx-iv-dashboard-card"><h3><TbCpuOff className="pmx-iv-dashboard-icon" />Core+{marginInfra}%</h3><p>{vCpuWithMargin}</p></div>
              <div className="pmx-iv-dashboard-card"><h3><TbCpuOff className="pmx-iv-dashboard-icon" />Ghz+{marginInfra}%</h3><p>{ghzWithMargin}</p></div>
              <div className="pmx-iv-dashboard-card"><h3><BsMemory className="pmx-iv-dashboard-icon" />RAM+{marginInfra}%</h3><p>{ramWithMargin}</p></div>
              <div className="pmx-iv-dashboard-card"><h3><BsDeviceHdd className="pmx-iv-dashboard-icon" />Storage+{marginInfra}%</h3><p>{storageWithMargin}</p></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProxmoxInfraDash;

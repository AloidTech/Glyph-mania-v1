import React, { useState } from 'react';
import {
  FloppyDiskIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  BrainIcon,
  FileCodeIcon,
  XIcon,
  InfoIcon,
  FolderSimpleIcon,
  SparkleIcon,
  ArrowRightIcon,
  TagIcon,
  CalendarIcon,
  ChartLineUpIcon,
  DownloadSimple,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { SavedModel, SortField, SortDirection } from '../../types/model_types';
import { useSavedModelsStore } from '../../lib/ml/saved_models_store';
import { useTrainingStore } from '../../lib/ml/training_store';
import { ClickOutside } from '../Utils/ClickOutside';

interface SavedModelsExplorerProps {
  currentSigilLabel?: string;
}

export const SavedModelsExplorer: React.FC<SavedModelsExplorerProps> = ({ currentSigilLabel }) => {
  const models = useSavedModelsStore((state) => state.models);
  const saveModel = useSavedModelsStore((state) => state.saveModel);
  const renameModel = useSavedModelsStore((state) => state.renameModel);
  const deleteModel = useSavedModelsStore((state) => state.deleteModel);
  const loadModel = useSavedModelsStore((state) => state.loadModel);

  // Active weights in training store
  const savedWeights = useTrainingStore((state) => state.savedWeights);
  const trainedClassLabels = useTrainingStore((state) => state.trainedClassLabels);
  const trainingProgress = useTrainingStore((state) => state.trainingProgress);
  const isModelUnsaved = useTrainingStore((state) => state.isModelUnsaved);
  const totalExamplesCount = useTrainingStore((state) => state.getTotalExamplesCount());

  // UI state
  const [selectedModel, setSelectedModel] = useState<SavedModel | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [modelToRename, setModelToRename] = useState<SavedModel | null>(null);
  const [newModelName, setNewModelName] = useState('');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const hasUnsavedTrainedModel = Boolean(savedWeights && savedWeights.length > 0 && isModelUnsaved);
  const canSaveCurrent = hasUnsavedTrainedModel;

  // Open Save Modal
  const handleOpenSaveModal = () => {
    if (!canSaveCurrent) {
      if (!savedWeights || savedWeights.length === 0) {
        toast.error('No trained model weights available to save. Train a model first!');
      } else {
        toast('Current model checkpoint is already saved.', { icon: 'ℹ️' });
      }
      return;
    }
    const defaultName = `${currentSigilLabel ? currentSigilLabel + ' ' : ''}Classifier v${models.length + 1}`;
    setNewModelName(defaultName);
    setNewModelDesc(`Trained over ${trainedClassLabels.length} classes with ${totalExamplesCount} exemplars.`);
    setSaveModalOpen(true);
  };

  // Submit Save Model
  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedWeights) return;

    const finalLoss = trainingProgress?.loss ?? 0.04;
    const finalAccuracy = trainingProgress?.accuracy ?? 1.0;
    const epochs = trainingProgress?.totalEpochs ?? 30;

    const saved = saveModel({
      name: newModelName.trim() || 'Untitled Model',
      description: newModelDesc.trim(),
      epochs,
      finalLoss,
      finalAccuracy,
      totalExamplesCount,
      classLabels: trainedClassLabels,
      weights: savedWeights,
    });

    useTrainingStore.getState().tagExamplesWithModel(saved.id, trainedClassLabels);
    setSaveModalOpen(false);
    toast.success(`Model "${saved.name}" saved successfully!`);
    setSelectedModel(saved);
  };

  // Submit Rename Model
  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelToRename || !newModelName.trim()) return;

    renameModel(modelToRename.id, newModelName.trim());
    toast.success('Model renamed.');
    if (selectedModel?.id === modelToRename.id) {
      setSelectedModel((prev) => (prev ? { ...prev, name: newModelName.trim() } : null));
    }
    setRenameModalOpen(false);
    setModelToRename(null);
  };

  // Open Rename Dialog
  const handleOpenRename = (e: React.MouseEvent, model: SavedModel) => {
    e.stopPropagation();
    setModelToRename(model);
    setNewModelName(model.name);
    setRenameModalOpen(true);
  };

  // Delete Model
  const handleDelete = (e: React.MouseEvent, model: SavedModel) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${model.name}"?`)) {
      deleteModel(model.id);
      toast.success(`Deleted model "${model.name}".`);
      if (selectedModel?.id === model.id) {
        setSelectedModel(null);
      }
    }
  };

  // Load Model
  const handleLoad = (e: React.MouseEvent, model: SavedModel) => {
    e.stopPropagation();
    loadModel(model.id);
    toast.success(`Loaded "${model.name}" as the active model.`);
    setSelectedModel((prev) => (prev?.id === model.id ? { ...prev, isLoaded: true } : prev));
  };

  // Download Model
  const handleDownload = (e: React.MouseEvent, model: SavedModel) => {
    e.stopPropagation();
    try {
      const dataStr = JSON.stringify(model, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${model.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_model.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded "${model.name}".`);
    } catch (err) {
      toast.error('Failed to download model.');
    }
  };

  // Sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Sorted models
  const sortedModels = [...models].sort((a, b) => {
    let factor = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'name') return factor * a.name.localeCompare(b.name);
    if (sortField === 'createdAt') return factor * (a.createdAt - b.createdAt);
    if (sortField === 'finalAccuracy') return factor * (a.finalAccuracy - b.finalAccuracy);
    if (sortField === 'finalLoss') return factor * (a.finalLoss - b.finalLoss);
    return 0;
  });

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate total parameters
  const getTotalParams = (model: SavedModel) => {
    return model.weights.reduce((sum, w) => {
      const count = w.shape.reduce((a, b) => a * b, 1);
      return sum + count;
    }, 0);
  };

  const hasAnyDisplayItems = models.length > 0 || hasUnsavedTrainedModel;

  return (
    <div className="canvas-container-card saved-models-card" style={{ height: '100%' }}>
      {/* Container Header */}
      <div className="canvas-container-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FolderSimpleIcon size={18} color="var(--admin-accent)" weight="fill" />
          <h3>Saved Models Explorer</h3>
        </div>
        <button
          type="button"
          onClick={handleOpenSaveModal}
          disabled={!canSaveCurrent}
          className={`admin-btn ${canSaveCurrent ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
          style={{
            padding: '0.35rem 0.85rem',
            fontSize: '0.78rem',
            opacity: canSaveCurrent ? 1 : 0.6,
            cursor: canSaveCurrent ? 'pointer' : 'not-allowed',
          }}
          title={
            !savedWeights || savedWeights.length === 0
              ? 'Train a model first to enable saving'
              : !isModelUnsaved
                ? 'Current model checkpoint is already saved'
                : 'Save the newly trained model checkpoint'
          }
        >
          <FloppyDiskIcon size={14} weight="bold" />
          {canSaveCurrent ? 'Save Current Model' : 'No Unsaved Model'}
        </button>
      </div>

      {/* File Explorer Content Area */}
      <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', background: 'var(--admin-paper-warm)' }}>
        {!hasAnyDisplayItems ? (
          /* Empty State */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px dashed var(--admin-border-strong)',
              borderRadius: '12px',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              background: 'var(--admin-paper)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--admin-accent-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <FolderSimpleIcon size={28} color="var(--admin-accent)" weight="fill" />
            </div>
            <h4 style={{ margin: '0 0 0.35rem', fontFamily: 'var(--font-heading)', color: 'var(--admin-ink)' }}>
              No Saved Models Yet
            </h4>
            <p
              style={{
                margin: '0 0 1.25rem',
                fontSize: '0.85rem',
                color: 'var(--admin-ink-muted)',
                maxWidth: 320,
                lineHeight: 1.45,
              }}
            >
              Train your neural network on the left, then save your trained model checkpoints here for future reuse.
            </p>
            <button
              type="button"
              onClick={handleOpenSaveModal}
              disabled={!canSaveCurrent}
              className="admin-btn admin-btn-primary"
              style={{ fontSize: '0.825rem', padding: '0.5rem 1.15rem' }}
            >
              <FloppyDiskIcon size={16} weight="bold" />
              Save Current Model
            </button>
          </div>
        ) : (
          /* Populated File System Table View */
          <div className="model-file-table-wrapper">
            <table className="model-file-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} className="sortable">
                    Name {sortField === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('createdAt')} className="sortable">
                    Date Modified {sortField === 'createdAt' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('finalAccuracy')} className="sortable text-right">
                    Accuracy {sortField === 'finalAccuracy' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('finalLoss')} className="sortable text-right">
                    Loss {sortField === 'finalLoss' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* ── Unsaved Model Row (Grey Tint & Unsaved Tag) ── */}
                {hasUnsavedTrainedModel && (
                  <tr
                    className="model-file-row unsaved-row"
                    onClick={handleOpenSaveModal}
                    title="Click to save this new trained model checkpoint"
                  >
                    <td className="model-name-cell">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <FileCodeIcon size={18} color="var(--admin-ink-muted)" weight="regular" />
                        <div>
                          <div className="model-file-title" style={{ color: 'var(--admin-ink-secondary)' }}>
                            {currentSigilLabel ? `${currentSigilLabel} Classifier (New)` : 'New Trained Model'}
                            <span className="unsaved-badge">Unsaved</span>
                          </div>
                          <div className="model-file-sub" style={{ color: 'var(--admin-ink-muted)' }}>
                            Trained over {trainedClassLabels.length} classes · Click to save
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="model-date-cell" style={{ fontStyle: 'italic' }}>
                      Just now
                    </td>

                    <td className="model-metric-cell text-right" style={{ color: 'var(--admin-ink-secondary)', fontWeight: 600 }}>
                      {((trainingProgress?.accuracy ?? 1.0) * 100).toFixed(1)}%
                    </td>

                    <td className="model-metric-cell text-right" style={{ color: 'var(--admin-ink-muted)', fontFamily: 'var(--font-mono)' }}>
                      {(trainingProgress?.loss ?? 0.04).toFixed(4)}
                    </td>

                    <td className="model-actions-cell text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="model-actions-grid">
                        <div className="action-primary-slot">
                          <button
                            type="button"
                            onClick={handleOpenSaveModal}
                            className="admin-btn admin-btn-primary"
                            style={{ padding: '0.22rem 0.65rem', fontSize: '0.72rem', height: 24, minWidth: 48, lineHeight: 1 }}
                            title="Save this new model checkpoint"
                          >
                            <FloppyDiskIcon size={12} weight="bold" />
                            Save
                          </button>
                        </div>
                        <div className="action-secondary-slot" />
                      </div>
                    </td>
                  </tr>
                )}

                {/* ── Saved Models Rows ── */}
                {sortedModels.map((m) => {
                  const isSelected = selectedModel?.id === m.id;
                  const isLoaded = m.isLoaded;

                  return (
                    <tr
                      key={m.id}
                      className={`model-file-row ${isSelected ? 'selected' : ''} ${isLoaded ? 'active-loaded' : ''}`}
                      onClick={() => setSelectedModel(m)}
                    >
                      {/* Name Column with File Icon & Active Badge */}
                      <td className="model-name-cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <FileCodeIcon size={18} color="var(--admin-accent)" weight="fill" />
                          <div>
                            <div className="model-file-title">
                              {m.name}
                            </div>
                            {m.description && <div className="model-file-sub">{m.description}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Date Modified Column */}
                      <td className="model-date-cell">{formatDate(m.createdAt)}</td>

                      {/* Accuracy Column */}
                      <td className="model-metric-cell text-right" style={{ color: 'var(--admin-success)', fontWeight: 700 }}>
                        {(m.finalAccuracy * 100).toFixed(1)}%
                      </td>

                      {/* Loss Column */}
                      <td className="model-metric-cell text-right" style={{ color: 'var(--admin-ink-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {m.finalLoss.toFixed(4)}
                      </td>

                      {/* Actions Column: Two-part grid */}
                      <td className="model-actions-cell text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="model-actions-grid">
                          {/* Part 1: Load / Active button/badge */}
                          <div className="action-primary-slot">
                            {isLoaded ? (
                              <span
                                className="admin-btn active-badge"
                                style={{
                                  padding: '0.2rem 0.55rem',
                                  fontSize: '0.72rem',
                                  minWidth: 48,
                                  height: 24,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxSizing: 'border-box',
                                  lineHeight: 1,
                                  cursor: 'default',
                                  userSelect: 'none',
                                }}
                              >
                                Active
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleLoad(e, m)}
                                className="admin-btn admin-btn-secondary"
                                style={{
                                  padding: '0.2rem 0.55rem',
                                  fontSize: '0.72rem',
                                  minWidth: 48,
                                  height: 24,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxSizing: 'border-box',
                                  lineHeight: 1,
                                }}
                                title="Load this model into active memory"
                              >
                                Load
                              </button>
                            )}
                          </div>

                          {/* Part 2: Other action buttons */}
                          <div className="action-secondary-slot">
                            <button
                              type="button"
                              onClick={(e) => handleOpenRename(e, m)}
                              className="admin-btn admin-btn-ghost"
                              style={{ padding: '0.25rem', borderRadius: 4 }}
                              title="Rename model"
                            >
                              <PencilIcon size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDownload(e, m)}
                              className="admin-btn admin-btn-ghost"
                              style={{ padding: '0.25rem', borderRadius: 4 }}
                              title="Download model"
                            >
                              <DownloadSimple size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(e, m)}
                              className="admin-btn admin-btn-ghost"
                              style={{ padding: '0.25rem', color: 'var(--admin-danger)', borderRadius: 4 }}
                              title="Delete model"
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Save Current Model ── */}
      {saveModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <ClickOutside onClickOutside={() => setSaveModalOpen(false)}>
            <div className="admin-panel" style={{ width: 420, padding: '1.5rem', background: 'var(--admin-paper)', borderRadius: 12, boxShadow: 'var(--admin-modal-shadow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>Save Current Model</h3>
                <button type="button" onClick={() => setSaveModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--admin-ink-muted)' }}>
                  <XIcon size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveSubmit} className="admin-form">
                <div className="admin-form-group">
                  <label className="admin-label" htmlFor="model-name">
                    Model Name *
                  </label>
                  <input
                    id="model-name"
                    type="text"
                    className="admin-input"
                    placeholder="e.g. Fire Sigil Classifier v1"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label" htmlFor="model-desc">
                    Description / Notes
                  </label>
                  <textarea
                    id="model-desc"
                    className="admin-textarea"
                    style={{ minHeight: 70 }}
                    placeholder="Notes on dataset size, hyper-parameters, or performance..."
                    value={newModelDesc}
                    onChange={(e) => setNewModelDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setSaveModalOpen(false)} className="admin-btn admin-btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="admin-btn admin-btn-primary">
                    <FloppyDiskIcon size={16} weight="bold" />
                    Save Model
                  </button>
                </div>
              </form>
            </div>
          </ClickOutside>
        </div>
      )}

      {/* ── Modal: Rename Model ── */}
      {renameModalOpen && modelToRename && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <ClickOutside onClickOutside={() => setRenameModalOpen(false)}>
            <div className="admin-panel" style={{ width: 400, padding: '1.5rem', background: 'var(--admin-paper)', borderRadius: 12, boxShadow: 'var(--admin-modal-shadow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>Rename Model</h3>
                <button type="button" onClick={() => setRenameModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--admin-ink-muted)' }}>
                  <XIcon size={18} />
                </button>
              </div>

              <form onSubmit={handleRenameSubmit} className="admin-form">
                <div className="admin-form-group">
                  <label className="admin-label" htmlFor="rename-model-name">
                    New Model Name *
                  </label>
                  <input
                    id="rename-model-name"
                    type="text"
                    className="admin-input"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setRenameModalOpen(false)} className="admin-btn admin-btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="admin-btn admin-btn-primary">
                    Rename
                  </button>
                </div>
              </form>
            </div>
          </ClickOutside>
        </div>
      )}

      {/* ── Modal: Inspect Saved Model Details ── */}
      {selectedModel && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <ClickOutside onClickOutside={() => setSelectedModel(null)}>
            <div
              className="admin-panel"
              style={{
                width: 520,
                maxWidth: '92vw',
                padding: '1.75rem',
                background: 'var(--admin-paper)',
                borderRadius: 14,
                boxShadow: 'var(--admin-modal-shadow)',
                position: 'relative',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileCodeIcon size={24} color="var(--admin-accent)" weight="fill" />
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: 'var(--admin-ink)' }}>
                      {selectedModel.name}
                    </h3>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--admin-ink-muted)', marginTop: '0.2rem' }}>
                    ID: <code style={{ fontSize: '0.75rem' }}>{selectedModel.id}</code>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedModel(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--admin-ink-muted)', padding: 4 }}
                >
                  <XIcon size={20} />
                </button>
              </div>

              {/* Description */}
              {selectedModel.description && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    background: 'var(--admin-paper-muted)',
                    borderRadius: 8,
                    fontSize: '0.85rem',
                    color: 'var(--admin-ink-secondary)',
                    marginBottom: '1.25rem',
                  }}
                >
                  {selectedModel.description}
                </div>
              )}

              {/* Metrics Summary Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ background: 'var(--admin-paper-warm)', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--admin-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-ink-muted)', fontWeight: 700 }}>
                    Final Accuracy
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--admin-success)', marginTop: 2 }}>
                    {(selectedModel.finalAccuracy * 100).toFixed(1)}%
                  </div>
                </div>

                <div style={{ background: 'var(--admin-paper-warm)', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--admin-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-ink-muted)', fontWeight: 700 }}>
                    Final Loss
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--admin-accent)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {selectedModel.finalLoss.toFixed(4)}
                  </div>
                </div>

                <div style={{ background: 'var(--admin-paper-warm)', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--admin-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-ink-muted)', fontWeight: 700 }}>
                    Training Epochs
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--admin-ink)', marginTop: 2 }}>
                    {selectedModel.epochs}
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--admin-border)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--admin-ink-muted)' }}>Created Date:</span>
                  <span style={{ fontWeight: 600 }}>{formatDate(selectedModel.createdAt)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--admin-border)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--admin-ink-muted)' }}>Total Examples:</span>
                  <span style={{ fontWeight: 600 }}>{selectedModel.totalExamplesCount} exemplars</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--admin-border)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--admin-ink-muted)' }}>Total Network Parameters:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{getTotalParams(selectedModel).toLocaleString()} params</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ color: 'var(--admin-ink-muted)' }}>Trained Class Labels ({selectedModel.classLabels.filter(l => l !== '__unknown__').length}):</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {selectedModel.classLabels
                      .filter((l) => l !== '__unknown__')
                      .map((label) => (
                        <span
                          key={label}
                          style={{
                            padding: '0.2rem 0.5rem',
                            background: 'var(--admin-paper-muted)',
                            border: '1px solid var(--admin-border)',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          {label}
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid var(--admin-border)', paddingTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    handleDelete(e, selectedModel);
                  }}
                  className="admin-btn admin-btn-danger"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <TrashIcon size={14} /> Delete
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    handleDownload(e, selectedModel);
                  }}
                  className="admin-btn admin-btn-secondary"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <DownloadSimple size={14} /> Download
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    handleOpenRename(e, selectedModel);
                  }}
                  className="admin-btn admin-btn-secondary"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <PencilIcon size={14} /> Rename
                </button>

                {!selectedModel.isLoaded && (
                  <button
                    type="button"
                    onClick={(e) => {
                      handleLoad(e, selectedModel);
                    }}
                    className="admin-btn admin-btn-primary"
                    style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                  >
                    <CheckCircleIcon size={16} weight="bold" /> Load Active Model
                  </button>
                )}
              </div>
            </div>
          </ClickOutside>
        </div>
      )}
    </div>
  );
};

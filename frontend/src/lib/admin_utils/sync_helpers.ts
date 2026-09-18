import toast from 'react-hot-toast';
import { createSigilApi, saveGlyphApi } from '../apis/api';
import { useAdminSigilsStore } from '../stores/admin_sigils_store';
import { useAdminGlyphsStore } from '../stores/admin_glyphs_store';
import { useWorkshopDraftStore } from '../stores/workshop_draft_store';

export interface SyncSigilInput {
  id: string;
  label: string;
  description?: string;
  tier?: number;
  svgPath?: string;
  coverAsset?: string;
  textureKey?: string;
  type: 'effector' | 'augmentor';
  element?: any;
  augmentorType?: any;
  formType?: any;
}

export interface SyncGlyphInput {
  id: string;
  name: string;
  description?: string;
  element?: any;
  tier?: number;
  composition: any;
  isPublic?: boolean;
  coverAsset?: string;
  previewUrl?: string;
}

/**
 * Syncs a sigil draft to the Supabase database via the create-sigil edge function.
 * On success, clears the draft from the local store and reloads remote sigils.
 */
export async function syncSigil(sigil: SyncSigilInput): Promise<boolean> {
  const toastId = toast.loading(`Saving "${sigil.label}" to database…`);
  try {
    await createSigilApi({
      id: sigil.id,
      label: sigil.label.trim(),
      description: (sigil.description || '').trim(),
      tier: sigil.tier || 1,
      cover_asset: sigil.coverAsset || sigil.svgPath || '/sigils/svg/eff-fire.svg',
      svg_path: sigil.coverAsset || sigil.svgPath || '/sigils/svg/eff-fire.svg',
      texture_key: sigil.textureKey || sigil.label.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      type: sigil.type,
      element: sigil.type === 'effector' ? sigil.element : undefined,
      augmentor_type: sigil.type === 'augmentor' ? sigil.augmentorType : undefined,
      form_type: sigil.type === 'augmentor' && sigil.augmentorType === 'form' ? sigil.formType : undefined,
      coverImageBase64: sigil.coverAsset?.startsWith('data:image') ? sigil.coverAsset : undefined,
    });

    // Clear draft from store so unsaved/draft status is cleared
    useAdminSigilsStore.getState().clearDraft(sigil.id);

    // Reload remote sigils so state is updated
    await useAdminSigilsStore.getState().loadRemoteSigils();

    toast.dismiss(toastId);
    toast.success(`"${sigil.label}" saved to remote database!`);
    return true;
  } catch (err: any) {
    toast.dismiss(toastId);
    console.error('Error syncing sigil:', err);
    const msg = String(err?.message || err || '');
    if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
      toast(`"${sigil.label}" saved locally as draft (Sign in to sync to cloud)`, { icon: '📝' });
    } else if (msg.includes('Failed to send a request') || msg.includes('FunctionsHttpError') || msg.includes('404')) {
      toast(`"${sigil.label}" saved locally as draft (Server unavailable)`, { icon: '📝' });
    } else {
      toast.error(`Sync failed: ${msg}`);
    }
    return false;
  }
}

/**
 * Syncs a glyph draft to the Supabase database via the save-glyph edge function.
 * On success, clears the draft from the local store and reloads remote glyphs.
 */
export async function syncGlyph(glyph: SyncGlyphInput): Promise<boolean> {
  const toastId = toast.loading(`Saving "${glyph.name}" to database…`);
  try {
    await saveGlyphApi({
      id: glyph.id,
      name: glyph.name.trim(),
      description: (glyph.description || '').trim(),
      element: glyph.element || 'fire',
      tier: glyph.tier || 1,
      isPublic: Boolean(glyph.isPublic),
      composition: glyph.composition || { directions: {}, formAugmentors: {} },
      coverImageBase64: glyph.coverAsset || glyph.previewUrl,
    });

    // Clear draft from admin store so unsaved/draft status is cleared
    useAdminGlyphsStore.getState().clearDraft(glyph.id);

    // Clear workshop draft if this matches or if currently set
    const wsStore = useWorkshopDraftStore.getState();
    if (wsStore.workshopDraft && (wsStore.workshopDraft.id === glyph.id || !glyph.id)) {
      wsStore.clearWorkshopDraft();
    }

    // Reload remote glyphs so state is updated
    await useAdminGlyphsStore.getState().loadRemoteGlyphs();

    toast.dismiss(toastId);
    toast.success(`"${glyph.name}" saved to remote database!`);
    return true;
  } catch (err: any) {
    toast.dismiss(toastId);
    console.error('Error syncing glyph:', err);
    const msg = String(err?.message || err || '');
    if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
      toast(`"${glyph.name}" saved locally as draft (Sign in to sync to cloud)`, { icon: '📝' });
    } else if (msg.includes('Failed to send a request') || msg.includes('FunctionsHttpError') || msg.includes('404')) {
      toast(`"${glyph.name}" saved locally as draft (Server unavailable)`, { icon: '📝' });
    } else {
      toast.error(`Sync failed: ${msg}`);
    }
    return false;
  }
}

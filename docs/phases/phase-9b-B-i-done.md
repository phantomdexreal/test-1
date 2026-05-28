# Phase 9b-B-i — Done: Item Image Support

## What Was Built

### Item Images — optional per item, stored locally in AppData

- **`imagePath` field** — already present on `InventoryItemFull` and in the DB migration (`002_inventory_phase9b_a.ts`) as `image_path TEXT DEFAULT ''`. No additional migration needed.

### Main Process (Electron)

**`src/main/ipc/handlers/app.handler.ts`** — four new IPC handlers:
| Channel | Purpose |
|---|---|
| `image:pick` | Shows a native file picker filtered to images (.jpg, .jpeg, .png, .gif, .webp, .bmp); returns chosen path or null |
| `image:copyToAppData` | Copies the chosen file to `AppData/cQikly/item-images/<itemId>.<ext>`; creates the folder if absent; returns the destination path |
| `image:readAsDataUrl` | Reads the stored file and returns a base64 data URL (`data:image/<mime>;base64,...`) for use as an `<img src>` |
| `image:delete` | Deletes the stored image file; silently succeeds if already gone |

**`src/main/ipc/index.ts`** — four new channel constants: `IMAGE_PICK`, `IMAGE_COPY_TO_APPDATA`, `IMAGE_READ_AS_DATA_URL`, `IMAGE_DELETE`.

### Preload & Types

**`src/main/preload.ts`** — `window.cqikly.image` object exposed with four typed wrappers.

**`src/renderer/types/cqiklyApi.d.ts`** — `image` block added to the `CQiklyAPI` interface.

### Renderer Service

**`src/renderer/services/inventory.service.ts`** — three new async methods added:

| Method | Description |
|---|---|
| `pickAndSetItemImage(itemId)` | Runs the file picker, copies to AppData (Electron) or reads as base64 (dev), updates `item.imagePath`, returns the data URL |
| `getItemImageDataUrl(itemId)` | Reads `item.imagePath`, returns the image as a data URL or null |
| `removeItemImage(itemId)` | Deletes the file (or removes from localStorage), clears `item.imagePath` |

**Dev/browser mode fallback**: When `window.cqikly` is not present (running via `npm run dev` without Electron), the service uses `<input type="file">` + `FileReader` + `localStorage` under the key `cq:inventory:img:<itemId>`. The sentinel value `'ls:<itemId>'` in `imagePath` distinguishes this from an AppData path.

### Renderer Component

**`src/renderer/pages/Inventory/ItemImageCell.tsx`** — new component rendered inline inside the Item Name column cell:

- Loads image on mount (and re-loads whenever `imagePath` changes)
- When item **has an image**: shows a 30×30 thumbnail (object-fit: cover, rounded corners)
- When item **has no image**: renders zero pixels — no gap, no placeholder
- On **row hover** with image: thumbnail + Change (🔄) + Remove (✕) action buttons appear inline
- On **row hover** without image: a small Add Image (🖼+) button appears
- All async image ops go through `inventoryService` — no direct IPC from the component

**`src/renderer/pages/Inventory/index.tsx`** changes:
- Imports `ItemImageCell`
- Adds `hoveredRowId` state (per-row mouse enter/leave)
- `<tr>` elements now have `onMouseEnter`/`onMouseLeave` for hover tracking
- Item Name column cell is now a flex container: `ItemImageCell` + `<input>` side by side; input takes remaining flex space so the column width is preserved

**`src/renderer/index.css`** — `@keyframes spin` added for the loading spinner.

## Decisions Made

1. **Storage**: AppData copy (not a symlink, not a reference to the original path). If the user moves or deletes the original, the image persists in the app. Clean separation.
2. **Dev mode**: localStorage base64 encode. This means large images inflate localStorage but is fine for development. In production Electron, AppData files are used.
3. **Zero gap when no image**: `ItemImageCell` returns `<></>` (empty fragment) when there is nothing to show and the row is not hovered. The item name input simply fills the column as before.
4. **Image not shown on removed item**: when `removeItemImage` is called, the service fires `inventoryService.updateItem(itemId, { imagePath: '' })` which emits `inventoryChanged`, causing the `useInventoryData` hook to reload, which propagates the cleared `imagePath` down to `ItemImageCell` and causes it to clear its `dataUrl` state.
5. **Image persists across restarts**: in Electron, `imagePath` is the absolute file path in AppData; on restart the service reads it and calls `image:readAsDataUrl` which reads from disk. In dev mode, the base64 string is in localStorage which also persists.

## Known Issues / Handoff State

- **Large images**: no resize/compress step. A 5 MB PNG is stored as-is in AppData. Future improvement: add a resize-before-copy step in the IPC handler.
- **Dev mode localStorage limit**: ~5 MB total for localStorage. Multiple large images in dev mode may fail silently. Not an issue in production.
- **Image shown in autocomplete suggestion card (9b-B-ii)**: `getItemImageDataUrl` is already public and ready to be consumed by the autocomplete suggestion card in the next phase. The data URL just needs to be loaded asynchronously there.
- **No image column in the table header**: the image is inline with Item Name, not a separate column, so no header is needed and no column width is consumed.

## Test Checklist

- [ ] Add image to an item → thumbnail appears in the item name column
- [ ] Change image → new thumbnail immediately replaces old one
- [ ] Remove image → row returns to normal, no gap
- [ ] Hover row with no image → small Add Image button appears; click it → file picker opens
- [ ] Hover row with image → Change and Remove buttons appear alongside thumbnail
- [ ] Restart app → image still present in the row (AppData persistence)
- [ ] Items without images → no broken placeholder, no gap, no extra space
- [ ] Multiple items with and without images → layout correct throughout

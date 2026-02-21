import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconSymbolName = string;

const MAPPING: Record<string, ComponentProps<typeof MaterialIcons>["name"]> = {
  // Navigation / Tab icons
  "house.fill": "home",
  "calendar": "calendar-today",
  "calendar.fill": "event",
  "list.bullet": "format-list-bulleted",
  "note.text": "sticky-note-2",
  "doc.fill": "folder",
  "paperplane.fill": "send",
  // Chevrons
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "chevron.down": "expand-more",
  "chevron.up": "expand-less",
  // Actions
  "plus": "add",
  "plus.circle.fill": "add-circle",
  "minus": "remove",
  "xmark": "close",
  "xmark.circle.fill": "cancel",
  "checkmark": "check",
  "checkmark.circle.fill": "check-circle",
  "pencil": "edit",
  "trash": "delete",
  "trash.fill": "delete",
  "square.and.arrow.down": "download",
  "square.and.arrow.up": "upload",
  "magnifyingglass": "search",
  "bell": "notifications-none",
  "bell.fill": "notifications",
  "bell.badge.fill": "notifications-active",
  // Content
  "star": "star-border",
  "star.fill": "star",
  "heart": "favorite-border",
  "heart.fill": "favorite",
  "tag": "label",
  "tag.fill": "label",
  "person": "person-outline",
  "person.fill": "person",
  "person.2": "group",
  "person.2.fill": "group",
  "person.crop.circle": "account-circle",
  "gearshape": "settings",
  "gearshape.fill": "settings",
  "ellipsis": "more-horiz",
  "ellipsis.circle": "more-horiz",
  "square.grid.2x2": "grid-view",
  "rectangle.grid.1x2": "view-agenda",
  "arrow.left": "arrow-back",
  "arrow.right": "arrow-forward",
  "arrow.up": "arrow-upward",
  "arrow.down": "arrow-downward",
  "arrow.clockwise": "refresh",
  "arrow.up.arrow.down": "swap-vert",
  // Files
  "doc": "insert-drive-file",
  "doc.text": "description",
  "photo": "image",
  "photo.fill": "image",
  "folder": "folder",
  "folder.fill": "folder",
  "paperclip": "attach-file",
  "link": "link",
  // Status
  "circle": "radio-button-unchecked",
  "circle.fill": "circle",
  "checkmark.circle": "check-circle-outline",
  "clock": "access-time",
  "clock.fill": "access-time-filled",
  "exclamationmark.circle": "error-outline",
  "info.circle": "info-outline",
  // Layout
  "rectangle.portrait": "crop-portrait",
  "square.on.square": "content-copy",
  "eye": "visibility",
  "eye.slash": "visibility-off",
  "lock": "lock-outline",
  "lock.fill": "lock",
  "crown": "workspace-premium",
  "crown.fill": "workspace-premium",
  "sparkles": "auto-awesome",
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}

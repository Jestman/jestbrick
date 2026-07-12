/**
 * JestBrick veritabanı şeması — tek kaynak.
 * RLS politikaları, tetikleyiciler ve FTS için db/rls.sql ile birlikte uygulanır.
 * Mimari referansı: https://claude.ai/code/artifact/64829469-3e7b-4d1a-bbe6-95149c9b8799
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  smallint,
  numeric,
  date,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

/* ---------------- enums ---------------- */

export const userRole = pgEnum("user_role", ["standard", "creator", "moderator", "staff"]);
export const itemVisibility = pgEnum("item_visibility", ["public", "private"]);
export const collectionCondition = pgEnum("collection_condition", ["sealed", "built", "parts"]);
export const postKind = pgEnum("post_kind", [
  "photo",
  "collection_add",
  "listing_share",
  "topic_share",
  "moc",
]);
export const listingCondition = pgEnum("listing_condition", ["sealed", "complete", "used"]);
export const listingStatus = pgEnum("listing_status", ["active", "reserved", "sold", "removed"]);
export const conversationKind = pgEnum("conversation_kind", ["direct", "listing"]);
export const messageKind = pgEnum("message_kind", ["user", "match_offer"]);
export const notificationType = pgEnum("notification_type", [
  "wishlist_listing",
  "demand_on_owned",
  "follow",
  "like",
  "comment",
  "reply",
  "listing_interest",
]);
export const reportTargetKind = pgEnum("report_target_kind", [
  "user",
  "post",
  "listing",
  "topic_post",
]);

/* ---------------- kimlik & sosyal graf ---------------- */

// id = auth.users.id — FK ve otomatik satır açma tetikleyicisi rls.sql'de.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull().default(""),
    bio: text("bio").notNull().default(""),
    role: userRole("role").notNull().default("standard"),
    sellerVerified: boolean("seller_verified").notNull().default(false),
    city: text("city"),
    avatarPath: text("avatar_path"),
    wishlistPublic: boolean("wishlist_public").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_handle_lower_idx").on(t.handle)]
);

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    followeeId: uuid("followee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index("follows_followee_idx").on(t.followeeId),
  ]
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })]
);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetKind: reportTargetKind("target_kind").notNull(),
  targetId: uuid("target_id").notNull(),
  reason: text("reason").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/* ---------------- set kataloğu (salt-okunur, sync besler) ---------------- */

export const themes = pgTable("themes", {
  id: integer("id").primaryKey(), // Rebrickable theme id
  name: text("name").notNull(),
  parentId: integer("parent_id"),
});

export const sets = pgTable(
  "sets",
  {
    setNum: text("set_num").primaryKey(), // "10323-1"
    name: text("name").notNull(),
    nameTr: text("name_tr"),
    themeId: integer("theme_id").references(() => themes.id),
    year: integer("year").notNull(),
    numParts: integer("num_parts").notNull().default(0),
    imagePath: text("image_path"), // Storage kopyası; yoksa imageUrl kullanılır
    imageUrl: text("image_url"), // Rebrickable CDN orijinali
    msrpTry: numeric("msrp_try", { precision: 10, scale: 2 }),
    retiredAt: date("retired_at"),
    lastModified: timestamp("last_modified", { withTimezone: true }),
    // search tsvector kolonu rls.sql'de generated column olarak eklenir
  },
  (t) => [index("sets_theme_idx").on(t.themeId), index("sets_year_idx").on(t.year)]
);

export const minifigs = pgTable("minifigs", {
  figNum: text("fig_num").primaryKey(), // "fig-006447"
  name: text("name").notNull(),
  numParts: integer("num_parts").notNull().default(0),
  imageUrl: text("image_url"),
});

export const setMinifigs = pgTable(
  "set_minifigs",
  {
    setNum: text("set_num").notNull().references(() => sets.setNum, { onDelete: "cascade" }),
    figNum: text("fig_num").notNull().references(() => minifigs.figNum, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.setNum, t.figNum] }),
    index("set_minifigs_fig_idx").on(t.figNum),
  ]
);

/* ---------------- koleksiyon & istek listesi ---------------- */

// Tekil minifigür düzeltmeleri: setten türetilen sayıya eklenen fark.
// delta > 0 → tekil edinilen; delta < 0 → setten gelip elden çıkan (ör. satıldı).
// Toplam = setlerden türetilen + delta (0 altına inmez, uygulama katmanında sınırlanır).
export const collectionMinifigs = pgTable(
  "collection_minifigs",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    figNum: text("fig_num").notNull().references(() => minifigs.figNum, { onDelete: "cascade" }),
    delta: integer("delta").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.figNum] })]
);

export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    setNum: text("set_num").notNull().references(() => sets.setNum),
    condition: collectionCondition("condition").notNull().default("built"),
    note: text("note"),
    visibility: itemVisibility("visibility").notNull().default("public"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("collection_user_set_uq").on(t.userId, t.setNum),
    index("collection_set_idx").on(t.setNum),
  ]
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    setNum: text("set_num").notNull().references(() => sets.setNum),
    maxPriceTry: numeric("max_price_try", { precision: 10, scale: 2 }),
    notifyOnListing: boolean("notify_on_listing").notNull().default(true),
    contactable: boolean("contactable").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("wishlist_user_set_uq").on(t.userId, t.setNum),
    index("wishlist_set_idx").on(t.setNum), // eşleştirme motorunun ana erişim yolu
  ]
);

/* ---------------- sosyal içerik ---------------- */

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: postKind("kind").notNull().default("photo"),
    body: text("body").notNull().default(""),
    setNum: text("set_num").references(() => sets.setNum),
    listingId: uuid("listing_id"),
    topicId: uuid("topic_id"),
    likeCount: integer("like_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("posts_author_created_idx").on(t.authorId, t.createdAt)]
);

export const postMedia = pgTable("post_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  position: smallint("position").notNull().default(0),
});

export const likes = pgTable(
  "likes",
  {
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })]
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"), // tek seviye yanıt
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("comments_post_idx").on(t.postId)]
);

/* ---------------- forum ---------------- */

export const forumCategories = pgTable("forum_categories", {
  id: smallint("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull().default("💬"),
  description: text("description").notNull().default(""),
  position: smallint("position").notNull().default(0),
});

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: smallint("category_id").notNull().references(() => forumCategories.id),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    locked: boolean("locked").notNull().default(false),
    lastPostAt: timestamp("last_post_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("topics_category_lastpost_idx").on(t.categoryId, t.lastPostAt)]
);

export const topicPosts = pgTable(
  "topic_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("topic_posts_topic_idx").on(t.topicId, t.createdAt)]
);

/* ---------------- pazar ---------------- */

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerId: uuid("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    setNum: text("set_num").notNull().references(() => sets.setNum),
    priceTry: numeric("price_try", { precision: 10, scale: 2 }).notNull(),
    condition: listingCondition("condition").notNull(),
    description: text("description").notNull().default(""),
    city: text("city"),
    ships: boolean("ships").notNull().default(true),
    status: listingStatus("status").notNull().default("active"),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("listings_set_status_idx").on(t.setNum, t.status),
    index("listings_seller_idx").on(t.sellerId),
  ]
);

export const listingImages = pgTable("listing_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  position: smallint("position").notNull().default(0),
});

export const sellerRatings = pgTable(
  "seller_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id").notNull().references(() => listings.id).unique(),
    raterId: uuid("rater_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    score: smallint("score").notNull(), // 1-5, CHECK kısıtı rls.sql'de
    comment: text("comment"),
    createdAt: createdAt(),
  },
  (t) => [index("seller_ratings_seller_idx").on(t.sellerId)]
);

/* ---------------- mesajlaşma & bildirim ---------------- */

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: conversationKind("kind").notNull().default("direct"),
  listingId: uuid("listing_id").references(() => listings.id),
  createdAt: createdAt(),
});

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("participants_user_idx").on(t.userId),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: messageKind("kind").notNull().default("user"),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)]
);

// Toplu "elimde var" mesajı kotası: UNIQUE kısıtlar spam korumasını DB seviyesinde garantiler.
export const matchBroadcasts = pgTable(
  "match_broadcasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    setNum: text("set_num").notNull().references(() => sets.setNum),
    recipientCount: integer("recipient_count").notNull().default(0),
    sentOn: date("sent_on").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("broadcast_daily_uq").on(t.senderId, t.sentOn)]
);

// Site ayarları: sayfa aç-kapa vb. Herkes okur, sadece service_role yazar.
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_unread_idx").on(t.userId, t.readAt)]
);

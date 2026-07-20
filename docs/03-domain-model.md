# Lumora Domain Model

This document describes the core business domains of Lumora at an architectural level. It defines purpose, responsibilities, and relationships only — no schema, API, or implementation detail.

---

## 1. Family

**Purpose:** Represents the overarching unit that owns and organizes all data belonging to a household or care group.

**Main responsibilities:**
- Acts as the top-level container that ties together users, children, and shared history.
- Establishes the boundary within which data is shared and permissions are granted.

**Relationships:**
- Contains one or more **Family Members**.
- Contains one or more **Child** and/or **Pregnancy** records.
- Scopes **Timeline**, **Media**, and **Health** data to a single family unit.

---

## 2. Users

**Purpose:** Represents an individual person who can authenticate and interact with Lumora.

**Main responsibilities:**
- Holds identity information independent of any specific family role.
- Serves as the actor behind actions taken within the system.

**Relationships:**
- A User becomes a **Family Member** when associated with a **Family**.
- A User may belong to more than one **Family** (e.g., separated parents, caregivers).
- **Permissions** are granted to a User within the context of a **Family**.

---

## 3. Family Members

**Purpose:** Represents the role and relationship a **User** holds within a specific **Family**.

**Main responsibilities:**
- Defines the nature of a person's involvement (e.g., mother, father, guardian, relative).
- Provides the context in which **Permissions** are evaluated.

**Relationships:**
- Links a **User** to a **Family**.
- Determines the scope of visibility into **Child**, **Pregnancy**, **Timeline**, **Media**, and **Health** data.

---

## 4. Pregnancy

**Purpose:** Represents the period and experience of expecting a child, prior to birth.

**Main responsibilities:**
- Tracks the pregnancy journey as a distinct phase with its own relevance and lifecycle.
- Serves as a source of early milestones and health context.

**Relationships:**
- Belongs to a **Family**.
- May transition into or be linked with a **Child** record upon birth.
- Contributes entries to **Timeline** and **Health**.

---

## 5. Child

**Purpose:** Represents an individual child within the family, from birth (or transition from Pregnancy) onward.

**Main responsibilities:**
- Acts as the central subject around which growth, memories, and care information are organized.
- Preserves the child's identity and continuity over time.

**Relationships:**
- Belongs to a **Family**.
- May originate from a **Pregnancy** record.
- Is the subject of **Timeline**, **Media**, and **Health** entries.
- Visibility is governed by **Permissions**.

---

## 6. Timeline

**Purpose:** Represents the chronological record of significant moments, milestones, and events.

**Main responsibilities:**
- Organizes events in a sequential, narrative structure.
- Provides continuity across **Pregnancy** and **Child** stages.

**Relationships:**
- Associated with a **Family**, a **Child**, and/or a **Pregnancy**.
- May reference **Media** items as part of an event.
- May reference **Health** entries when an event has medical relevance.

---

## 7. Media

**Purpose:** Represents photos, videos, and other captured content associated with family life.

**Main responsibilities:**
- Preserves visual and recorded memories.
- Provides supporting content for other domains without being the primary record itself.

**Relationships:**
- Belongs to a **Family**.
- May be attached to **Timeline** entries.
- May be associated with a **Child** or **Pregnancy**.
- Access is governed by **Permissions**.

---

## 8. Health

**Purpose:** Represents health-related information relevant to a **Pregnancy** or **Child**.

**Main responsibilities:**
- Holds sensitive medical and wellbeing context.
- Supports informed awareness without providing diagnosis or medical authority.

**Relationships:**
- Associated with a **Child** or **Pregnancy**.
- May contribute entries to **Timeline**.
- Subject to stricter **Permissions** than other domains, consistent with its sensitivity.

---

## 9. Permissions

**Purpose:** Represents the rules governing who may view or act upon data within a **Family**.

**Main responsibilities:**
- Enforces boundaries of visibility and control across all other domains.
- Reflects the role defined by **Family Members** rather than acting independently.

**Relationships:**
- Applies to a **User** in the context of a **Family**.
- Governs access to **Child**, **Pregnancy**, **Timeline**, **Media**, and **Health** domains.

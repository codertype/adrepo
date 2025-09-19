import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Get delivery partner profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const profile = await storage.getDeliveryPartner(req.user!.id);
    if (!profile) {
      return res.status(404).json({ message: "Delivery partner profile not found" });
    }
    res.json(profile);
  } catch (error) {
    console.error("Error fetching delivery profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update delivery partner location
router.patch("/location", requireAuth, async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    
    await storage.updateDeliveryPartnerLocation(req.user!.id, {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      currentLocation: address || `${latitude}, ${longitude}`,
      lastLocationUpdate: new Date()
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating location:", error);
    res.status(500).json({ message: "Failed to update location" });
  }
});

// Update online status
router.patch("/status", requireAuth, async (req, res) => {
  try {
    const { isOnline } = req.body;
    
    await storage.updateDeliveryPartnerStatus(req.user!.id, isOnline);
    
    res.json({ success: true, isOnline });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ message: "Failed to update status" });
  }
});

// Get delivery stats
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const stats = await storage.getDeliveryPartnerStats(req.user!.id);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching delivery stats:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get assigned orders
router.get("/orders", requireAuth, async (req, res) => {
  try {
    const orders = await storage.getDeliveryPartnerOrders(req.user!.id);
    res.json(orders);
  } catch (error) {
    console.error("Error fetching delivery orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
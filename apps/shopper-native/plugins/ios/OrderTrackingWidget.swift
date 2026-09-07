/**
 * Order Tracking Live Activity Widget
 * 
 * This widget displays real-time order tracking information on the iOS lock screen
 * and in the Dynamic Island.
 * 
 * Requirements:
 * - iOS 16.1+
 * - WidgetKit framework
 * - ActivityKit framework
 */

import WidgetKit
import SwiftUI
import ActivityKit

// MARK: - Activity Attributes
struct OrderTrackingAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic content that can be updated
        var driverName: String
        var driverLocation: String // e.g., "Near Downtown"
        var estimatedArrival: Int // minutes
        var status: String // "picked_up", "delivered", etc.
        var progress: Double // 0.0 - 1.0
        var driverPhoto: String? // URL to driver photo
    }
    
    // Static content that doesn't change
    var orderId: String
    var originAddress: String
    var destinationAddress: String
}

// MARK: - Live Activity Widget Configuration
@main
struct OrderTrackingWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: OrderTrackingAttributes.self) { context in
            // Lock Screen / Expanded view
            LockScreenView(context: context)
        } dynamicIsland: { context in
            // Dynamic Island views
            DynamicIsland {
                // Expanded Dynamic Island
                DynamicIslandExpandedRegion(.leading) {
                    LeadingView(context: context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TrailingView(context: context)
                }
                DynamicIslandExpandedRegion(.center) {
                    CenterView(context: context)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    BottomView(context: context)
                }
            } compactLeading: {
                // Compact view (left side of Dynamic Island)
                CompactLeadingView(context: context)
            } compactTrailing: {
                // Compact view (right side of Dynamic Island)
                CompactTrailingView(context: context)
            } minimal: {
                // Minimal view (when multiple activities are shown)
                MinimalView(context: context)
            }
        }
    }
}

// MARK: - Lock Screen View
struct LockScreenView: View {
    let context: ActivityViewContext<OrderTrackingAttributes>
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                // Driver avatar or placeholder
                if let photoURL = context.state.driverPhoto,
                   let url = URL(string: photoURL) {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 40, height: 40)
                            .clipShape(Circle())
                    } placeholder: {
                        Circle()
                            .fill(Color.gray.opacity(0.3))
                            .frame(width: 40, height: 40)
                    }
                } else {
                    Circle()
                        .fill(Color.purple)
                        .frame(width: 40, height: 40)
                        .overlay(
                            Text("🚗")
                                .font(.title2)
                        )
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.driverName)
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Text(context.state.driverLocation)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                // ETA badge
                VStack(alignment: .trailing) {
                    Text("\(context.state.estimatedArrival) min")
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(.purple)
                    
                    Text("ETA")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            
            // Progress bar
            VStack(alignment: .leading, spacing: 4) {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 6)
                        
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.purple)
                            .frame(width: geometry.size.width * context.state.progress, height: 6)
                            .animation(.easeInOut, value: context.state.progress)
                    }
                }
                .frame(height: 6)
                
                HStack {
                    Text(context.attributes.originAddress)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Text(context.attributes.destinationAddress)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            
            // Status badge
            HStack {
                Text(statusEmoji(for: context.state.status))
                    .font(.caption)
                Text(statusText(for: context.state.status))
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(statusColor(for: context.state.status))
                
                Spacer()
                
                Text("🔄 LIVE")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(.red)
            }
        }
        .padding()
        .activityBackgroundTint(Color(.systemBackground))
        .activitySystemActionForegroundColor(Color(.label))
    }
    
    // MARK: - Helper functions for status
    func statusEmoji(for status: String) -> String {
        switch status {
        case "pending": return "⏳"
        case "accepted": return "✅"
        case "picked_up": return "🚚"
        case "delivered": return "🎉"
        case "cancelled": return "❌"
        default: return "📦"
        }
    }
    
    func statusText(for status: String) -> String {
        switch status {
        case "pending": return "Awaiting driver"
        case "accepted": return "Driver accepted"
        case "picked_up": return "On the way"
        case "delivered": return "Delivered"
        case "cancelled": return "Cancelled"
        default: return "In progress"
        }
    }
    
    func statusColor(for status: String) -> Color {
        switch status {
        case "pending": return .yellow
        case "accepted": return .blue
        case "picked_up": return .purple
        case "delivered": return .green
        case "cancelled": return .red
        default: return .gray
        }
    }
}

// MARK: - Dynamic Island Views

// Compact Leading (left side of Dynamic Island)
struct CompactLeadingView: View {
    let context: ActivityViewContext<OrderTrackingAttributes>
    
    var body: some View {
        HStack {
            Image(systemName: "car.fill")
                .foregroundColor(.purple)
            Text("\(context.state.estimatedArrival)m")
                .font(.caption)
                .fontWeight(.bold)
        }
    }
}

// Compact Trailing (right side of Dynamic Island)
struct CompactTrailingView: View {
    let context: ActivityViewContext<OrderTrackingAttributes>
    
    var body: some View {
        Text(statusIcon(for: context.state.status))
            .font(.caption)
    }
    
    func statusIcon(for status: String) -> String {
        switch status {
        case "picked_up": return "🔄"
        case "delivered": return "✅"
        default: return "📦"
        }
    }
}

// Minimal View (when multiple activities are shown)
struct MinimalView: View {
    let context: ActivityViewContext<OrderTrackingAttributes>
    
    var body: some View {
        Image(systemName: "car.fill")
            .foregroundColor(.purple)
    }
}

// MARK: - Dynamic Island Expanded Views

// Leading (left side of expanded Dynamic Island)
struct LeadingView: View {
    let context: ActivityViewContext<OrderTrackingAttributes>
    
    var body: some View {
        HStack {
            if let photoURL = context.state.driverPhoto,
               let url = URL(string: photoURL) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 40, height: 40)
                        .clipShape(Circle())
                } placeholder: {
                    Circle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 40, height: 40)
                }
            } else {
                Circle()
                    .fill(Color.purple)
                    .frame(width: 40, height: 40)
                    .overlay(
                        Text("🚗")
                            .font(.title2)
                    )
            }
            
            VStack(alignment: .leading) {
                Text(context.state.driverName)
                    .font(.headline)
                    .fontWeight(.semibold)
                Text(context.state.driverLocation)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

// Trailing (right side of expanded Dynamic Island)
struct TrailingView: View {
    let context: ActivityViewContext<OrderTrackingAttributes>
    
    var body: some View {
        VStack(alignment: .trailing) {
            Text("\(context.state.estimatedArrival)m")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.purple)
            Text("ETA")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

// Center (middle of expanded Dynamic Island)
struct CenterView: View {
    let context: ActivityViewContext<OrderTrackingAttributes>
    
    var body: some View {
        VStack(spacing: 4) {
            Text("\(context.attributes.originAddress) → \(context.attributes.destinationAddress)")
                .font(.caption)
                .lineLimit(1)
                .foregroundColor(.secondary)
            
            HStack {
                Text(statusEmoji(for: context.state.status))
                Text(statusText(for: context.state.status))
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(statusColor(for: context.state.status))
            }
        }
    }
    
    func statusEmoji(for status: String) -> String {
        switch status {
        case "pending": return "⏳"
        case "accepted": return "✅"
        case "picked_up": return "🚚"
        case "delivered": return "🎉"
        case "cancelled": return "❌"
        default: return "📦"
        }
    }
    
    func statusText(for status: String) -> String {
        switch status {
        case "pending": return "Awaiting driver"
        case "accepted": return "Driver accepted"
        case "picked_up": return "On the way"
        case "delivered": return "Delivered"
        case "cancelled": return "Cancelled"
        default: return "In progress"
        }
    }
    
    func statusColor(for status: String) -> Color {
        switch status {
        case "pending": return .yellow
        case "accepted": return .blue
        case "picked_up": return .purple
        case "delivered": return .green
        case "cancelled": return .red
        default: return .gray
        }
    }
}

// Bottom (bottom of expanded Dynamic Island)
struct BottomView: View {
    let context: ActivityViewContext<OrderTrackingAttributes>
    
    var body: some View {
        VStack(spacing: 4) {
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 4)
                    
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.purple)
                        .frame(width: geometry.size.width * context.state.progress, height: 4)
                        .animation(.easeInOut, value: context.state.progress)
                }
            }
            .frame(height: 4)
            
            HStack {
                Text(context.attributes.originAddress)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Text(context.attributes.destinationAddress)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal)
    }
}
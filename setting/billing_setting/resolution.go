package billing_setting

import (
	"strconv"
	"strings"
	"unicode"
)

// NormalizeResolution maps request / config labels onto a stable lookup key.
// Canonical form matches Ali / MiniMax docs: 720P, 768P, 2K, 4K.
// Examples: 720p → 720P, 4k → 4K, 1920x1080 → 1080P, 768 → 768P.
func NormalizeResolution(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	if s == "" {
		return DefaultResolution
	}
	s = strings.ReplaceAll(s, " ", "")

	if w, h, ok := splitResolutionDims(s); ok {
		return heightToResolution(min(w, h))
	}

	switch s {
	case "2k", "1440p", "1440":
		return "2K"
	case "4k", "2160p", "2160":
		return "4K"
	}

	s = strings.TrimSuffix(s, "p")
	if s == "" {
		return DefaultResolution
	}
	if isDigits(s) {
		return heightToResolutionFromLabel(s)
	}
	// Non-standard labels stay lowercase for stable matching.
	return s
}

// FormatResolutionLower returns Vidu / Kling style labels (720p, 2k).
func FormatResolutionLower(raw string) string {
	return strings.ToLower(NormalizeResolution(raw))
}

// FormatResolutionUpper returns Ali / MiniMax style labels (720P, 2K).
func FormatResolutionUpper(raw string) string {
	return NormalizeResolution(raw)
}

func GetResolutionPrices(model string) map[string]float64 {
	return canonicalizeResolutionPriceMap(billingSetting.ResolutionPrice[model])
}

func HasResolutionPrice(model string) bool {
	return len(billingSetting.ResolutionPrice[model]) > 0
}

// GetResolutionPrice returns the USD unit price for a model at the given
// resolution. Unlisted resolutions fall back to 720P.
func GetResolutionPrice(model, resolution string) (float64, bool) {
	prices := billingSetting.ResolutionPrice[model]
	if len(prices) == 0 {
		return 0, false
	}
	if price, ok := lookupNormalizedPrice(prices, NormalizeResolution(resolution)); ok {
		return price, true
	}
	if price, ok := lookupNormalizedPrice(prices, DefaultResolution); ok {
		return price, true
	}
	return 0, false
}

func GetResolutionPriceCopy() map[string]map[string]float64 {
	out := make(map[string]map[string]float64, len(billingSetting.ResolutionPrice))
	for model, prices := range billingSetting.ResolutionPrice {
		if copied := canonicalizeResolutionPriceMap(prices); len(copied) > 0 {
			out[model] = copied
		}
	}
	return out
}

// canonicalizeResolutionPriceMap rewrites stored keys to the canonical billing
// form (720P / 2K / 4K). Duplicate keys that normalize to the same label keep
// the first seen price.
func canonicalizeResolutionPriceMap(prices map[string]float64) map[string]float64 {
	if len(prices) == 0 {
		return nil
	}
	out := make(map[string]float64, len(prices))
	for key, price := range prices {
		canon := NormalizeResolution(key)
		if _, exists := out[canon]; exists {
			continue
		}
		out[canon] = price
	}
	return out
}

func lookupNormalizedPrice(prices map[string]float64, want string) (float64, bool) {
	if price, ok := prices[want]; ok {
		return price, true
	}
	for key, price := range prices {
		if NormalizeResolution(key) == want {
			return price, true
		}
	}
	return 0, false
}

func splitResolutionDims(s string) (int, int, bool) {
	sep := ""
	switch {
	case strings.Contains(s, "x"):
		sep = "x"
	case strings.Contains(s, "*"):
		sep = "*"
	default:
		return 0, 0, false
	}
	parts := strings.Split(s, sep)
	if len(parts) != 2 {
		return 0, 0, false
	}
	width, errW := strconv.Atoi(parts[0])
	height, errH := strconv.Atoi(parts[1])
	if errW != nil || errH != nil || width <= 0 || height <= 0 {
		return 0, 0, false
	}
	return width, height, true
}

func heightToResolution(height int) string {
	switch height {
	case 360:
		return "360P"
	case 480:
		return "480P"
	case 512:
		return "512P"
	case 540:
		return "540P"
	case 720:
		return "720P"
	case 768:
		return "768P"
	case 1080:
		return "1080P"
	case 1440:
		return "2K"
	case 2160:
		return "4K"
	default:
		return strconv.Itoa(height) + "P"
	}
}

func heightToResolutionFromLabel(digits string) string {
	height, err := strconv.Atoi(digits)
	if err != nil || height <= 0 {
		return DefaultResolution
	}
	return heightToResolution(height)
}

func isDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}

package events

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
)

// EventType enum
const (
	EventTypeError   uint8 = 0
	EventTypeChanged uint8 = 1
	EventTypeDeleted uint8 = 2
	EventTypeListIDs uint8 = 3
)

// Event structs
type EventBase struct {
	Type       uint8
	Src        uint8
	Collection uint16
}

type ErrorEvent struct {
	Type uint8
	Code string
}

type ChangedEvent struct {
	EventBase
	Item Item
}

type DeletedEvent struct {
	EventBase
	Item string
}

type ListIDsEvent struct {
	EventBase
	IDs []string
}

type Item struct {
	ID         string
	Src        uint8
	CreatedAt  uint64
	ChangedAt  uint64
	Collection uint16
	Props      map[string]interface{}
}

func DeserializeEvent(buf []byte) interface{} {
	eventType := buf[0]
	src := buf[1]

	switch eventType {
	case EventTypeError:
		code := string(buf[1:])
		return ErrorEvent{
			Type: eventType,
			Code: code,
		}

	case EventTypeChanged:
		collection := binary.LittleEndian.Uint16(buf[2:4])
		id := base64.RawURLEncoding.EncodeToString(buf[4:20])
		createdAt := binary.LittleEndian.Uint64(buf[20:28])
		changedAt := binary.LittleEndian.Uint64(buf[28:36])
		var props map[string]interface{}
		json.Unmarshal(buf[36:], &props)

		return ChangedEvent{
			EventBase: EventBase{Type: eventType, Src: src, Collection: collection},
			Item: Item{
				ID:         id,
				Src:        src,
				CreatedAt:  createdAt,
				ChangedAt:  changedAt,
				Collection: collection,
				Props:      props,
			},
		}

	case EventTypeListIDs:
		collection := binary.LittleEndian.Uint16(buf[2:4])
		count := (len(buf) - 4) / 16
		ids := make([]string, count)
		for i := 0; i < count; i++ {
			idx := i*16 + 4
			ids[i] = base64.RawURLEncoding.EncodeToString(buf[idx : idx+16])
		}
		return ListIDsEvent{
			EventBase: EventBase{Type: eventType, Src: src, Collection: collection},
			IDs:       ids,
		}

	case EventTypeDeleted:
		collection := binary.LittleEndian.Uint16(buf[2:4])
		item := base64.RawURLEncoding.EncodeToString(buf[4:])
		return DeletedEvent{
			EventBase: EventBase{Type: eventType, Src: src, Collection: collection},
			Item:      item,
		}

	default:
		return fmt.Errorf("unknown event type: %d", eventType)
	}
}

package main

import (
	"log"
	"net/url"
	"os"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"

	"contfu_client/events"
)

func main() {
	err := godotenv.Load(".env")
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	host := getEnvOrDefault("UPSTREAM_HOST", "localhost")
	port := getEnvOrDefault("UPSTREAM_PORT", "3000")
	key := getEnvOrDefault("KEY", "")
	if key == "" {
		log.Fatal("KEY environment variable not set. Please set it before running the client.")
	}

	u := url.URL{Scheme: "ws", Host: host + ":" + port, Path: "/"}
	log.Printf("connecting to %s", u.String())

	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Fatal("dial:", err)
	}
	defer c.Close()

	keyBytes := []byte{0x01}
	keyBytes = append(keyBytes, []byte(key)...)
	err = c.WriteMessage(websocket.BinaryMessage, keyBytes)
	if err != nil {
		log.Fatal("write:", err)
	}

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			break
		}
		event := events.DeserializeEvent(message)
		log.Printf("Received event: %+v", event)
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

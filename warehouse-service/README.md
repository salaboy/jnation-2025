## To run
Build: 
```
mvn package -DskipTests
```

```
mvn spring-boot:test-run
```

Call HTTPie

```
http :8080/orders < order.json 
```

```
 http :8080/order/approve < order-approved.json
```

## Run on Kubernetes


```
helm upgrade --install dapr dapr/dapr \
--version=1.15.4 \
--namespace dapr-system \
--create-namespace \
--wait
```

```properties

```
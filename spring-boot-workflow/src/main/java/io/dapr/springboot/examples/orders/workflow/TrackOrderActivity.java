/*
 * Copyright 2025 The Dapr Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
limitations under the License.
*/

package io.dapr.springboot.examples.orders.workflow;


import io.dapr.springboot.examples.orders.Details;
import io.dapr.springboot.examples.orders.Order;
import io.dapr.springboot.examples.orders.OrderUpdate;
import io.dapr.springboot.examples.orders.OrdersStore;
import io.dapr.workflows.WorkflowActivity;
import io.dapr.workflows.WorkflowActivityContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Date;

@Component
public class TrackOrderActivity implements WorkflowActivity {

  private final Logger logger = LoggerFactory.getLogger(TrackOrderActivity.class);
  private final OrdersStore ordersStore;

  public TrackOrderActivity(OrdersStore ordersStore) {
    this.ordersStore = ordersStore;
  }

  @Autowired
  private RestTemplate restTemplate;
  @Override
  public Object run(WorkflowActivityContext ctx) {
    Order order = ctx.getInput(Order.class);
    logger.info("Order: " + order.getId() + " stored for tracking.");
    ordersStore.addOrder(order);
    HttpEntity<OrderUpdate> request =
            new HttpEntity<OrderUpdate>(new OrderUpdate(order.getId(), "Processing", new Details("Processing the order", new Date())));

    String orderUpdateString =
            restTemplate.postForObject("http://localhost:8787/update-order", request, String.class);
    logger.info("Update Order result: " + orderUpdateString );
    return order;
  }


}

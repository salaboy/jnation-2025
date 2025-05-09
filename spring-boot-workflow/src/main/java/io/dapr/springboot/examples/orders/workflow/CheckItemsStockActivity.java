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


import io.dapr.springboot.examples.orders.Order;
import io.dapr.springboot.examples.orders.OrdersStore;
import io.dapr.workflows.WorkflowActivity;
import io.dapr.workflows.WorkflowActivityContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class CheckItemsStockActivity implements WorkflowActivity {

  private final Logger logger = LoggerFactory.getLogger(CheckItemsStockActivity.class);
  private final OrdersStore ordersStore;

  public CheckItemsStockActivity(OrdersStore ordersStore) {
    this.ordersStore = ordersStore;
  }

  @Override
  public Object run(WorkflowActivityContext ctx) {
    Order order = ctx.getInput(Order.class);
    logger.info("Item: " + order.getItem() + " is in stock.");
    order.setInStock(true);
    ordersStore.addOrder(order);
    return order;
  }


}
